import { normalizeNotionPageId } from '../../src/utils/notionPageId.ts';
import { applyRevisionMutations, type RevisionMutation } from './_revisionSync.ts';
import type { Env, Session } from './types.ts';

const NOTION_VERSION = '2026-03-11';
const DEFAULT_DURATION_PROPERTY = 'Tracked Minutes';
const MAX_JOBS_PER_FLUSH = 10;
const MAX_BACKOFF_MS = 6 * 60 * 60 * 1000;

export interface NotionSessionRow {
    id: string;
    start_at: number;
    end_at: number | null;
    content_type: string | null;
    field_values: string | null;
}

interface NotionSyncJobRow {
    page_id: string;
    version: number;
    attempts: number;
    next_attempt_at: number;
    last_error: string | null;
    updated_at: number;
}

export interface NotionSyncStatus {
    pending: number;
    failed: number;
    lastError?: string;
}

function parsedPageId(fieldValues: unknown): string | null {
    if (!fieldValues || typeof fieldValues !== 'object' || Array.isArray(fieldValues)) return null;
    return normalizeNotionPageId((fieldValues as Record<string, unknown>).notionPageId);
}

function sessionPageId(session: Session): string | null {
    return session.contentType === 'notion-task' ? parsedPageId(session.fieldValues) : null;
}

function rowPageId(row: NotionSessionRow): string | null {
    if (row.content_type !== 'notion-task' || !row.field_values) return null;
    try {
        return parsedPageId(JSON.parse(row.field_values));
    } catch {
        return null;
    }
}

async function rowsBySessionIds(db: D1Database, ids: string[]): Promise<NotionSessionRow[]> {
    if (ids.length === 0) return [];
    const placeholders = ids.map(() => '?').join(', ');
    const result = await db.prepare(
        `SELECT id, start_at, end_at, content_type, field_values FROM sessions WHERE id IN (${placeholders})`
    ).bind(...ids).all<NotionSessionRow>();
    return result.results;
}

/** Determine old and new Notion task pages affected by session mutations. */
export async function affectedNotionPageIds(
    db: D1Database,
    mutations: RevisionMutation[],
): Promise<Set<string>> {
    const sessionMutations = mutations.filter(mutation => mutation.entityType === 'session');
    if (sessionMutations.length === 0) return new Set();

    const pageIds = new Set<string>();
    const oldRows = await rowsBySessionIds(db, sessionMutations.map(mutation => mutation.entityId));
    oldRows.forEach(row => {
        const pageId = rowPageId(row);
        if (pageId) pageIds.add(pageId);
    });
    sessionMutations.forEach(mutation => {
        if (mutation.operation !== 'upsert') return;
        const pageId = sessionPageId(mutation.value as Session);
        if (pageId) pageIds.add(pageId);
    });
    return pageIds;
}

/** Sum completed first-class sessions by Notion task. */
export function computeNotionTaskMinutes(rows: NotionSessionRow[]): Map<string, number> {
    const totalsMs = new Map<string, number>();
    rows.forEach(row => {
        if (row.end_at === null || row.end_at <= row.start_at) return;
        const pageId = rowPageId(row);
        if (!pageId) return;
        totalsMs.set(pageId, (totalsMs.get(pageId) || 0) + row.end_at - row.start_at);
    });
    return new Map(
        [...totalsMs].map(([pageId, totalMs]) => [
            pageId,
            Math.round((totalMs / 60_000) * 100) / 100,
        ]),
    );
}

export async function enqueueNotionSyncJobs(db: D1Database, pageIds: Iterable<string>): Promise<void> {
    const normalized = [...new Set(
        [...pageIds].map(normalizeNotionPageId).filter((id): id is string => Boolean(id))
    )];
    if (normalized.length === 0) return;
    const now = Date.now();
    await db.batch(normalized.map(pageId => db.prepare(`
        INSERT INTO notion_sync_jobs
          (page_id, version, attempts, next_attempt_at, last_error, updated_at)
        VALUES (?, 1, 0, 0, NULL, ?)
        ON CONFLICT(page_id) DO UPDATE SET
          version = notion_sync_jobs.version + 1,
          attempts = 0,
          next_attempt_at = 0,
          last_error = NULL,
          updated_at = excluded.updated_at
    `).bind(pageId, now)));
}

async function allTaskSessions(db: D1Database): Promise<NotionSessionRow[]> {
    const result = await db.prepare(`
        SELECT id, start_at, end_at, content_type, field_values
        FROM sessions
        WHERE content_type = 'notion-task'
        ORDER BY start_at ASC
    `).all<NotionSessionRow>();
    return result.results;
}

function nextRetryAt(attempts: number, now: number, retryAfterSeconds?: number): number {
    const exponential = Math.min(MAX_BACKOFF_MS, 60_000 * Math.pow(5, Math.max(0, attempts)));
    return now + Math.max(exponential, (retryAfterSeconds || 0) * 1000);
}

async function markFailed(
    db: D1Database,
    job: NotionSyncJobRow,
    message: string,
    retryAfterSeconds?: number,
): Promise<void> {
    const now = Date.now();
    await db.prepare(`
        UPDATE notion_sync_jobs
        SET attempts = attempts + 1, next_attempt_at = ?, last_error = ?, updated_at = ?
        WHERE page_id = ? AND version = ?
    `).bind(
        nextRetryAt(job.attempts, now, retryAfterSeconds),
        message.slice(0, 500),
        now,
        job.page_id,
        job.version,
    ).run();
}

async function syncJob(
    env: Env,
    job: NotionSyncJobRow,
    minutes: number,
    fetchFn: typeof fetch,
): Promise<void> {
    const token = env.NOTION_API_TOKEN?.trim();
    if (!token) {
        await markFailed(env.CHRONOLOG_DB, job, 'NOTION_API_TOKEN is not configured');
        return;
    }

    const property = env.NOTION_TRACKED_MINUTES_PROPERTY?.trim() || DEFAULT_DURATION_PROPERTY;
    try {
        const response = await fetchFn(`https://api.notion.com/v1/pages/${job.page_id}`, {
            method: 'PATCH',
            signal: AbortSignal.timeout(10_000),
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
                'Notion-Version': NOTION_VERSION,
            },
            body: JSON.stringify({ properties: { [property]: { number: minutes } } }),
        });
        if (!response.ok) {
            const body = await response.text().catch(() => '');
            const retryAfter = Number(response.headers.get('Retry-After') || 0);
            await markFailed(
                env.CHRONOLOG_DB,
                job,
                `Notion ${response.status}: ${body || response.statusText}`,
                Number.isFinite(retryAfter) ? retryAfter : undefined,
            );
            return;
        }
        await env.CHRONOLOG_DB.prepare(
            'DELETE FROM notion_sync_jobs WHERE page_id = ? AND version = ?'
        ).bind(job.page_id, job.version).run();
    } catch (error) {
        await markFailed(
            env.CHRONOLOG_DB,
            job,
            `Notion request failed: ${error instanceof Error ? error.message : String(error)}`,
        );
    }
}

export async function getNotionSyncStatus(db: D1Database): Promise<NotionSyncStatus> {
    const row = await db.prepare(`
        SELECT COUNT(*) AS pending,
               SUM(CASE WHEN last_error IS NOT NULL THEN 1 ELSE 0 END) AS failed,
               MAX(last_error) AS last_error
        FROM notion_sync_jobs
    `).first<{ pending: number | string; failed: number | string | null; last_error: string | null }>();
    return {
        pending: Number(row?.pending || 0),
        failed: Number(row?.failed || 0),
        ...(row?.last_error ? { lastError: row.last_error } : {}),
    };
}

export async function flushNotionSyncJobs(
    env: Env,
    fetchFn: typeof fetch = fetch,
): Promise<NotionSyncStatus> {
    const result = await env.CHRONOLOG_DB.prepare(`
        SELECT page_id, version, attempts, next_attempt_at, last_error, updated_at
        FROM notion_sync_jobs
        WHERE next_attempt_at <= ?
        ORDER BY updated_at ASC
        LIMIT ?
    `).bind(Date.now(), MAX_JOBS_PER_FLUSH).all<NotionSyncJobRow>();

    if (result.results.length > 0) {
        const totals = computeNotionTaskMinutes(await allTaskSessions(env.CHRONOLOG_DB));
        for (const job of result.results) {
            await syncJob(env, job, totals.get(job.page_id) || 0, fetchFn);
        }
    }
    return getNotionSyncStatus(env.CHRONOLOG_DB);
}

export async function applyMutationsWithNotionSync(env: Env, mutations: RevisionMutation[]) {
    const affected = await affectedNotionPageIds(env.CHRONOLOG_DB, mutations);
    if (affected.size === 0) {
        const result = await applyRevisionMutations(env.CHRONOLOG_DB, mutations);
        return { ...result, notionSync: undefined };
    }
    await enqueueNotionSyncJobs(env.CHRONOLOG_DB, affected);
    const result = await applyRevisionMutations(env.CHRONOLOG_DB, mutations);
    return { ...result, notionSync: await flushNotionSyncJobs(env) };
}
