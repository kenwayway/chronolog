import { normalizeNotionPageId } from '../../src/utils/notionPageId.ts';
import { applyRevisionMutations, type RevisionMutation } from './_revisionSync.ts';
import type { Entry, Env } from './types.ts';

const NOTION_VERSION = '2026-03-11';
const DEFAULT_DURATION_PROPERTY = 'Tracked Minutes';
const MAX_JOBS_PER_FLUSH = 10;
const MAX_BACKOFF_MS = 6 * 60 * 60 * 1000;

interface NotionBoundaryRow {
    id: string;
    type: string;
    timestamp: number;
    session_id: string | null;
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

function entryPageId(entry: Entry): string | null {
    if (entry.type !== 'SESSION_START' || entry.contentType !== 'notion-task') return null;
    return parsedPageId(entry.fieldValues);
}

function rowPageId(row: NotionBoundaryRow): string | null {
    if (row.type !== 'SESSION_START' || row.content_type !== 'notion-task' || !row.field_values) return null;
    try {
        return parsedPageId(JSON.parse(row.field_values));
    } catch {
        return null;
    }
}

function isBoundary(type: string): boolean {
    return type === 'SESSION_START' || type === 'SESSION_END';
}

async function rowsByEntryIds(db: D1Database, ids: string[]): Promise<NotionBoundaryRow[]> {
    if (ids.length === 0) return [];
    const placeholders = ids.map(() => '?').join(', ');
    const result = await db.prepare(
        `SELECT id, type, timestamp, session_id, content_type, field_values FROM entries WHERE id IN (${placeholders})`
    ).bind(...ids).all<NotionBoundaryRow>();
    return result.results;
}

async function startsBySessionIds(db: D1Database, sessionIds: string[]): Promise<NotionBoundaryRow[]> {
    if (sessionIds.length === 0) return [];
    const placeholders = sessionIds.map(() => '?').join(', ');
    const result = await db.prepare(
        `SELECT id, type, timestamp, session_id, content_type, field_values FROM entries ` +
        `WHERE type = 'SESSION_START' AND session_id IN (${placeholders})`
    ).bind(...sessionIds).all<NotionBoundaryRow>();
    return result.results;
}

/** Determine both old and new task pages affected by an entry mutation batch. */
export async function affectedNotionPageIds(
    db: D1Database,
    mutations: RevisionMutation[],
): Promise<Set<string>> {
    const entryMutations = mutations.filter(mutation => {
        if (mutation.entityType !== 'entry') return false;
        if (mutation.operation === 'delete') return true;
        return isBoundary((mutation.value as Entry).type);
    });
    if (entryMutations.length === 0) return new Set();

    const oldRows = await rowsByEntryIds(db, entryMutations.map(mutation => mutation.entityId));
    const pageIds = new Set<string>();
    const sessionIds = new Set<string>();

    for (const row of oldRows) {
        const pageId = rowPageId(row);
        if (pageId) pageIds.add(pageId);
        if (isBoundary(row.type) && row.session_id) sessionIds.add(row.session_id);
    }

    for (const mutation of entryMutations) {
        if (mutation.operation !== 'upsert') continue;
        const entry = mutation.value as Entry;
        const pageId = entryPageId(entry);
        if (pageId) pageIds.add(pageId);
        if (isBoundary(entry.type) && entry.sessionId) sessionIds.add(entry.sessionId);
    }

    const relatedStarts = await startsBySessionIds(db, [...sessionIds]);
    for (const row of relatedStarts) {
        const pageId = rowPageId(row);
        if (pageId) pageIds.add(pageId);
    }

    return pageIds;
}

/** Recompute completed-session totals from boundary timestamps. */
export function computeNotionTaskMinutes(rows: NotionBoundaryRow[]): Map<string, number> {
    const sorted = [...rows].sort((left, right) => left.timestamp - right.timestamp);
    const open: NotionBoundaryRow[] = [];
    const totalsMs = new Map<string, number>();

    for (const row of sorted) {
        if (row.type === 'SESSION_START') {
            open.push(row);
            continue;
        }
        if (row.type !== 'SESSION_END') continue;

        let startIndex = -1;
        if (row.session_id) {
            for (let index = open.length - 1; index >= 0; index--) {
                if (open[index].session_id === row.session_id) {
                    startIndex = index;
                    break;
                }
            }
        } else {
            startIndex = open.length - 1;
        }
        if (startIndex === -1) continue;

        const start = open[startIndex];
        open.splice(startIndex, 1);
        const durationMs = row.timestamp - start.timestamp;
        const pageId = rowPageId(start);
        if (!pageId || durationMs <= 0) continue;
        totalsMs.set(pageId, (totalsMs.get(pageId) || 0) + durationMs);
    }

    return new Map(
        [...totalsMs].map(([pageId, totalMs]) => [pageId, Math.round((totalMs / 60_000) * 100) / 100])
    );
}

export async function enqueueNotionSyncJobs(db: D1Database, pageIds: Iterable<string>): Promise<void> {
    const normalized = [...new Set([...pageIds].map(normalizeNotionPageId).filter((id): id is string => Boolean(id)))];
    if (normalized.length === 0) return;
    const now = Date.now();
    const statements = normalized.map(pageId => db.prepare(`
        INSERT INTO notion_sync_jobs
          (page_id, version, attempts, next_attempt_at, last_error, updated_at)
        VALUES (?, 1, 0, 0, NULL, ?)
        ON CONFLICT(page_id) DO UPDATE SET
          version = notion_sync_jobs.version + 1,
          attempts = 0,
          next_attempt_at = 0,
          last_error = NULL,
          updated_at = excluded.updated_at
    `).bind(pageId, now));
    await db.batch(statements);
}

async function allBoundaries(db: D1Database): Promise<NotionBoundaryRow[]> {
    const result = await db.prepare(
        `SELECT id, type, timestamp, session_id, content_type, field_values FROM entries ` +
        `WHERE type IN ('SESSION_START', 'SESSION_END') ORDER BY timestamp ASC`
    ).all<NotionBoundaryRow>();
    return result.results;
}

function nextRetryAt(attempts: number, now: number, retryAfterSeconds?: number): number {
    const exponential = Math.min(MAX_BACKOFF_MS, 60_000 * Math.pow(5, Math.max(0, attempts)));
    const retryAfter = retryAfterSeconds && retryAfterSeconds > 0 ? retryAfterSeconds * 1000 : 0;
    return now + Math.max(exponential, retryAfter);
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
            const message = `Notion ${response.status}: ${body || response.statusText}`;
            const retryAfter = Number(response.headers.get('Retry-After') || 0);
            await markFailed(env.CHRONOLOG_DB, job, message, Number.isFinite(retryAfter) ? retryAfter : undefined);
            return;
        }

        await env.CHRONOLOG_DB.prepare(
            'DELETE FROM notion_sync_jobs WHERE page_id = ? AND version = ?'
        ).bind(job.page_id, job.version).run();
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await markFailed(env.CHRONOLOG_DB, job, `Notion request failed: ${message}`);
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

/** Flush due jobs. Failures remain durable and never roll back Chronolog data. */
export async function flushNotionSyncJobs(env: Env, fetchFn: typeof fetch = fetch): Promise<NotionSyncStatus> {
    const now = Date.now();
    const result = await env.CHRONOLOG_DB.prepare(`
        SELECT page_id, version, attempts, next_attempt_at, last_error, updated_at
        FROM notion_sync_jobs
        WHERE next_attempt_at <= ?
        ORDER BY updated_at ASC
        LIMIT ?
    `).bind(now, MAX_JOBS_PER_FLUSH).all<NotionSyncJobRow>();

    if (result.results.length > 0) {
        const totals = computeNotionTaskMinutes(await allBoundaries(env.CHRONOLOG_DB));
        for (const job of result.results) {
            await syncJob(env, job, totals.get(job.page_id) || 0, fetchFn);
        }
    }

    return getNotionSyncStatus(env.CHRONOLOG_DB);
}

/** Apply a revision batch, enqueue affected tasks, then attempt pending Notion work. */
export async function applyMutationsWithNotionSync(env: Env, mutations: RevisionMutation[]) {
    const affected = await affectedNotionPageIds(env.CHRONOLOG_DB, mutations);
    if (affected.size === 0) {
        const result = await applyRevisionMutations(env.CHRONOLOG_DB, mutations);
        return { ...result, notionSync: undefined };
    }
    // Queue first so a transient failure applying the entry batch cannot lose
    // the old task ID needed by a delete or reassignment retry.
    await enqueueNotionSyncJobs(env.CHRONOLOG_DB, affected);
    const result = await applyRevisionMutations(env.CHRONOLOG_DB, mutations);
    const notionSync = await flushNotionSyncJobs(env);
    return { ...result, notionSync };
}
