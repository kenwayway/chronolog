import { describe, expect, it, vi } from 'vitest';
import { affectedNotionPageIds, computeNotionTaskMinutes, flushNotionSyncJobs } from './_notionSync.ts';
import type { Env } from './types.ts';
import type { RevisionMutation } from './_revisionSync.ts';

const PAGE_A = '12345678-90ab-cdef-1234-567890abcdef';
const PAGE_B = 'abcdef12-3456-7890-abcd-ef1234567890';

function row(id: string, startAt: number, endAt: number | null, pageId: string | null) {
    return {
        id,
        start_at: startAt,
        end_at: endAt,
        content_type: pageId ? 'notion-task' : 'note',
        field_values: pageId ? JSON.stringify({ notionPageId: pageId }) : null,
    };
}

describe('computeNotionTaskMinutes', () => {
    it('sums completed first-class sessions and ignores open or invalid spans', () => {
        const totals = computeNotionTaskMinutes([
            row('a1', 0, 30 * 60_000, PAGE_A),
            row('open', 31 * 60_000, null, PAGE_A),
            row('a2', 40 * 60_000, 55.5 * 60_000, PAGE_A),
            row('negative', 90 * 60_000, 80 * 60_000, PAGE_B),
        ]);
        expect(totals.get(PAGE_A)).toBe(45.5);
        expect(totals.has(PAGE_B)).toBe(false);
    });
});

describe('affectedNotionPageIds', () => {
    it('includes both old and reassigned task pages', async () => {
        const db = {
            prepare() {
                return {
                    bind() {
                        return { async all() { return { results: [row('changed', 0, 1, PAGE_A)] }; } };
                    },
                };
            },
        } as unknown as D1Database;
        const mutations: RevisionMutation[] = [{
            mutationId: 'change',
            entityType: 'session',
            entityId: 'changed',
            operation: 'upsert',
            value: {
                id: 'changed',
                content: 'changed',
                startAt: 0,
                endAt: 1,
                contentType: 'notion-task',
                fieldValues: { notionPageId: PAGE_B },
            },
        }];
        await expect(affectedNotionPageIds(db, mutations)).resolves.toEqual(new Set([PAGE_A, PAGE_B]));
    });
});

interface MutableJob {
    page_id: string;
    version: number;
    attempts: number;
    next_attempt_at: number;
    last_error: string | null;
    updated_at: number;
}

function notionDb(jobs: MutableJob[], sessions: ReturnType<typeof row>[]) {
    const run = async (sql: string, values: unknown[]) => {
        if (sql.includes('UPDATE notion_sync_jobs')) {
            const job = jobs.find(item => item.page_id === values[3] && item.version === values[4]);
            if (job) {
                job.attempts += 1;
                job.next_attempt_at = values[0] as number;
                job.last_error = values[1] as string;
                job.updated_at = values[2] as number;
            }
        }
        if (sql.includes('DELETE FROM notion_sync_jobs')) {
            const index = jobs.findIndex(item => item.page_id === values[0] && item.version === values[1]);
            if (index >= 0) jobs.splice(index, 1);
        }
        return { success: true };
    };
    const all = async (sql: string, values: unknown[]) => {
        if (sql.includes('FROM notion_sync_jobs') && sql.includes('next_attempt_at <= ?')) {
            return { results: jobs.filter(job => job.next_attempt_at <= Number(values[0])) };
        }
        if (sql.includes('FROM sessions')) return { results: sessions };
        return { results: [] };
    };
    const first = async (sql: string) => sql.includes('COUNT(*) AS pending')
        ? {
            pending: jobs.length,
            failed: jobs.filter(job => job.last_error).length,
            last_error: jobs.find(job => job.last_error)?.last_error || null,
        }
        : null;
    return {
        prepare(sql: string) {
            const bound = (values: unknown[]) => ({
                all: () => all(sql, values),
                first: () => first(sql),
                run: () => run(sql, values),
            });
            return { ...bound([]), bind: (...values: unknown[]) => bound(values) };
        },
    } as unknown as D1Database;
}

describe('flushNotionSyncJobs', () => {
    it('writes a recomputed value and removes a successful job', async () => {
        const jobs: MutableJob[] = [{ page_id: PAGE_A, version: 1, attempts: 0, next_attempt_at: 0, last_error: null, updated_at: 1 }];
        const db = notionDb(jobs, [row('a', 0, 90 * 60_000, PAGE_A)]);
        const fetchFn = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
            expect(JSON.parse(String(init?.body))).toEqual({ properties: { 'Tracked Minutes': { number: 90 } } });
            return new Response('{}', { status: 200 });
        }) as typeof fetch;
        const status = await flushNotionSyncJobs({ CHRONOLOG_DB: db, NOTION_API_TOKEN: 'secret' } as Env, fetchFn);
        expect(status).toEqual({ pending: 0, failed: 0 });
    });

    it('keeps failed jobs and honors retry hints', async () => {
        const jobs: MutableJob[] = [{ page_id: PAGE_A, version: 2, attempts: 0, next_attempt_at: 0, last_error: null, updated_at: 1 }];
        const db = notionDb(jobs, []);
        const before = Date.now();
        const fetchFn = vi.fn(async () => new Response('rate limited', {
            status: 429,
            headers: { 'Retry-After': '120' },
        })) as typeof fetch;
        const status = await flushNotionSyncJobs({ CHRONOLOG_DB: db, NOTION_API_TOKEN: 'secret' } as Env, fetchFn);
        expect(status).toMatchObject({ pending: 1, failed: 1 });
        expect(jobs[0].next_attempt_at).toBeGreaterThanOrEqual(before + 120_000);
    });
});
