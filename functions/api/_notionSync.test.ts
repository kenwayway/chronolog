import { describe, expect, it, vi } from 'vitest';
import { affectedNotionPageIds, computeNotionTaskMinutes, flushNotionSyncJobs } from './_notionSync.ts';
import type { Env } from './types.ts';
import type { RevisionMutation } from './_revisionSync.ts';

const PAGE_A = '12345678-90ab-cdef-1234-567890abcdef';
const PAGE_B = 'abcdef12-3456-7890-abcd-ef1234567890';

function start(id: string, timestamp: number, sessionId: string | null, pageId: string | null) {
    return {
        id,
        type: 'SESSION_START',
        timestamp,
        session_id: sessionId,
        content_type: pageId ? 'notion-task' : 'note',
        field_values: pageId ? JSON.stringify({ notionPageId: pageId }) : null,
    };
}

function end(id: string, timestamp: number, sessionId: string | null) {
    return {
        id,
        type: 'SESSION_END',
        timestamp,
        session_id: sessionId,
        content_type: 'note',
        field_values: null,
    };
}

describe('computeNotionTaskMinutes', () => {
    it('sums positive completed sessions and ignores open or invalid spans', () => {
        const totals = computeNotionTaskMinutes([
            start('a1', 0, 'a1', PAGE_A),
            end('a1-end', 30 * 60_000, 'a1'),
            start('open', 31 * 60_000, 'open', PAGE_A),
            start('a2', 40 * 60_000, 'a2', PAGE_A),
            end('a2-end', 55.5 * 60_000, 'a2'),
            start('negative', 90 * 60_000, 'negative', PAGE_B),
            end('negative-end', 80 * 60_000, 'negative'),
        ]);

        expect(totals.get(PAGE_A)).toBe(45.5);
        expect(totals.has(PAGE_B)).toBe(false);
    });

    it('pairs interleaved sessions by ID and supports legacy boundaries without IDs', () => {
        const totals = computeNotionTaskMinutes([
            start('a', 0, 'a', PAGE_A),
            start('b', 1_000, 'b', PAGE_B),
            end('a-end', 61_000, 'a'),
            end('b-end', 121_000, 'b'),
            start('legacy', 200_000, null, PAGE_A),
            end('legacy-end', 260_000, null),
        ]);

        expect(totals.get(PAGE_A)).toBe(2.02);
        expect(totals.get(PAGE_B)).toBe(2);
    });
});

describe('affectedNotionPageIds', () => {
    it('includes old, reassigned, and related task pages', async () => {
        const db = {
            prepare(sql: string) {
                return {
                    bind() {
                        return {
                            async all() {
                                if (sql.includes('WHERE id IN')) {
                                    return {
                                        results: [
                                            start('changed-start', 0, 'changed', PAGE_A),
                                            end('deleted-end', 60_000, 'deleted'),
                                        ],
                                    };
                                }
                                if (sql.includes("type = 'SESSION_START' AND session_id IN")) {
                                    return { results: [start('deleted-start', 0, 'deleted', PAGE_A)] };
                                }
                                return { results: [] };
                            },
                        };
                    },
                };
            },
        } as unknown as D1Database;
        const mutations: RevisionMutation[] = [
            {
                mutationId: 'change',
                entityType: 'entry',
                entityId: 'changed-start',
                operation: 'upsert',
                value: {
                    id: 'changed-start',
                    type: 'SESSION_START',
                    content: 'changed',
                    timestamp: 0,
                    sessionId: 'changed',
                    contentType: 'notion-task',
                    fieldValues: { notionPageId: PAGE_B },
                },
            },
            {
                mutationId: 'delete',
                entityType: 'entry',
                entityId: 'deleted-end',
                operation: 'delete',
            },
        ];

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

function notionDb(jobs: MutableJob[], boundaries: ReturnType<typeof start>[]) {
    const run = async (sql: string, values: unknown[]) => {
        if (sql.includes('UPDATE notion_sync_jobs')) {
            const pageId = values[3] as string;
            const version = values[4] as number;
            const job = jobs.find(item => item.page_id === pageId && item.version === version);
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
        if (sql.includes("type IN ('SESSION_START', 'SESSION_END')")) {
            return { results: boundaries };
        }
        return { results: [] };
    };

    const first = async (sql: string) => {
        if (sql.includes('COUNT(*) AS pending')) {
            return {
                pending: jobs.length,
                failed: jobs.filter(job => job.last_error).length,
                last_error: jobs.find(job => job.last_error)?.last_error || null,
            };
        }
        return null;
    };

    return {
        prepare(sql: string) {
            const bound = (values: unknown[]) => ({
                all: () => all(sql, values),
                first: () => first(sql),
                run: () => run(sql, values),
            });
            return {
                ...bound([]),
                bind: (...values: unknown[]) => bound(values),
            };
        },
    } as unknown as D1Database;
}

describe('flushNotionSyncJobs', () => {
    it('writes a recomputed value and removes a successful job', async () => {
        const jobs: MutableJob[] = [{ page_id: PAGE_A, version: 1, attempts: 0, next_attempt_at: 0, last_error: null, updated_at: 1 }];
        const db = notionDb(jobs, [start('a', 0, 'a', PAGE_A), end('end', 90 * 60_000, 'a')] as ReturnType<typeof start>[]);
        const fetchFn = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
            expect(JSON.parse(String(init?.body))).toEqual({ properties: { 'Tracked Minutes': { number: 90 } } });
            return new Response('{}', { status: 200 });
        }) as typeof fetch;

        const status = await flushNotionSyncJobs({ CHRONOLOG_DB: db, NOTION_API_TOKEN: 'secret' } as Env, fetchFn);

        expect(fetchFn).toHaveBeenCalledOnce();
        expect(status).toEqual({ pending: 0, failed: 0 });
        expect(jobs).toHaveLength(0);
    });

    it('keeps failed jobs and honors Notion retry hints', async () => {
        const jobs: MutableJob[] = [{ page_id: PAGE_A, version: 2, attempts: 0, next_attempt_at: 0, last_error: null, updated_at: 1 }];
        const db = notionDb(jobs, []);
        const before = Date.now();
        const fetchFn = vi.fn(async () => new Response('rate limited', {
            status: 429,
            headers: { 'Retry-After': '120' },
        })) as typeof fetch;

        const status = await flushNotionSyncJobs({ CHRONOLOG_DB: db, NOTION_API_TOKEN: 'secret' } as Env, fetchFn);

        expect(status.pending).toBe(1);
        expect(status.failed).toBe(1);
        expect(status.lastError).toContain('Notion 429');
        expect(jobs[0].next_attempt_at).toBeGreaterThanOrEqual(before + 120_000);
    });

    it.each([401, 404])('retains jobs when Notion returns %s', async statusCode => {
        const jobs: MutableJob[] = [{ page_id: PAGE_A, version: 1, attempts: 0, next_attempt_at: 0, last_error: null, updated_at: 1 }];
        const db = notionDb(jobs, []);
        const fetchFn = vi.fn(async () => new Response('not available', { status: statusCode })) as typeof fetch;

        const status = await flushNotionSyncJobs({ CHRONOLOG_DB: db, NOTION_API_TOKEN: 'secret' } as Env, fetchFn);

        expect(status).toMatchObject({ pending: 1, failed: 1 });
        expect(status.lastError).toContain(`Notion ${statusCode}`);
    });

    it('retains jobs after a network failure', async () => {
        const jobs: MutableJob[] = [{ page_id: PAGE_A, version: 1, attempts: 0, next_attempt_at: 0, last_error: null, updated_at: 1 }];
        const db = notionDb(jobs, []);
        const fetchFn = vi.fn(async () => { throw new Error('offline'); }) as typeof fetch;

        const status = await flushNotionSyncJobs({ CHRONOLOG_DB: db, NOTION_API_TOKEN: 'secret' } as Env, fetchFn);

        expect(status).toMatchObject({ pending: 1, failed: 1 });
        expect(status.lastError).toContain('offline');
    });
});
