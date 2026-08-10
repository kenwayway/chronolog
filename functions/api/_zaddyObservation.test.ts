import { describe, expect, it, vi } from 'vitest';

vi.mock('./_notionSync.ts', () => ({
    applyMutationsWithNotionSync: vi.fn(async () => ({
        revision: 1,
        appliedMutationIds: [],
        rejectedMutations: [],
    })),
}));

import {
    buildZaddyTimelineEntity,
    collectZaddyHandoffs,
    expireAbandonedZaddyTopics,
    observeZaddyTopic,
} from './_zaddyObservation.ts';
import type { Env, ZaddyTopicAppendRow, ZaddyTopicBufferRow } from './types.ts';

const MINUTE = 60 * 1000;

function buffer(overrides: Partial<ZaddyTopicBufferRow> = {}): ZaddyTopicBufferRow {
    return {
        id: 'buffer-1',
        content: '',
        last_append_at: 100,
        category: null,
        status: 'open',
        entity_type: null,
        entity_id: null,
        created_at: 100,
        updated_at: 100,
        ...overrides,
    };
}

function append(observedAt: number, content = 'line'): ZaddyTopicAppendRow {
    return {
        id: `append-${observedAt}`,
        buffer_id: 'buffer-1',
        content,
        observed_at: observedAt,
        created_at: observedAt,
    };
}

/** Enough of D1 to exercise the statements this module actually issues. */
function fakeEnv() {
    const buffers = new Map<string, ZaddyTopicBufferRow>();
    const appends: ZaddyTopicAppendRow[] = [];
    const db = {
        prepare(sql: string) {
            let values: unknown[] = [];
            const statement = {
                bind(...next: unknown[]) {
                    values = next;
                    return statement;
                },
                async all() {
                    if (sql.includes('FROM zaddy_topic_appends')) {
                        return {
                            results: appends
                                .filter(row => row.buffer_id === values[0])
                                .sort((left, right) => left.observed_at - right.observed_at),
                        };
                    }
                    const cutoff = Number(values[0]);
                    const excluded = sql.includes('id <> ?') ? String(values[1]) : null;
                    const limit = Number(values[values.length - 1]);
                    return {
                        results: [...buffers.values()]
                            .filter(row => row.status === 'open' && row.last_append_at < cutoff)
                            .filter(row => row.id !== excluded)
                            .sort((left, right) => left.last_append_at - right.last_append_at)
                            .slice(0, limit),
                    };
                },
                async first() {
                    return buffers.get(String(values[0])) ?? null;
                },
                async run() {
                    if (sql.includes('INSERT INTO zaddy_topic_buffers')) {
                        buffers.set(String(values[0]), buffer({
                            id: String(values[0]),
                            content: '',
                            last_append_at: Number(values[1]),
                            category: values[2] as string | null,
                            created_at: Number(values[3]),
                            updated_at: Number(values[4]),
                        }));
                    } else if (sql.includes('INSERT INTO zaddy_topic_appends')) {
                        appends.push({
                            id: String(values[0]),
                            buffer_id: String(values[1]),
                            content: String(values[2]),
                            observed_at: Number(values[3]),
                            created_at: Number(values[4]),
                        });
                    } else if (sql.includes("SET status = 'closed'")) {
                        const current = buffers.get(String(values[3]))!;
                        buffers.set(current.id, {
                            ...current,
                            status: 'closed',
                            entity_type: values[0] as 'note' | 'session',
                            entity_id: String(values[1]),
                            updated_at: Number(values[2]),
                        });
                    } else if (sql.includes('SET content = ?')) {
                        const current = buffers.get(String(values[4]))!;
                        buffers.set(current.id, {
                            ...current,
                            content: String(values[0]),
                            last_append_at: Number(values[1]),
                            category: values[2] as string | null,
                            updated_at: Number(values[3]),
                        });
                    }
                    return { success: true };
                },
            };
            return statement;
        },
    } as unknown as D1Database;
    return { env: { CHRONOLOG_DB: db } as Env, buffers, appends };
}

describe('buildZaddyTimelineEntity', () => {
    it('materializes a single-point topic as a zaddy note', () => {
        expect(buildZaddyTimelineEntity(
            buffer({ content: 'You settled the sync boundary.' }),
            [append(100)],
        )).toEqual({
            entityType: 'note',
            value: {
                id: 'zaddy:buffer-1',
                content: 'You settled the sync boundary.',
                timestamp: 100,
                origin: 'zaddy',
            },
        });
    });

    it('spans the appends, not the moment the summary was written', () => {
        expect(buildZaddyTimelineEntity(
            buffer({ content: 'Summarized days later.', category: 'craft', last_append_at: 999_999 }),
            [append(400), append(100), append(250)],
        )).toEqual({
            entityType: 'session',
            value: {
                id: 'zaddy:buffer-1',
                content: 'Summarized days later.',
                startAt: 100,
                endAt: 400,
                category: 'craft',
                origin: 'zaddy',
            },
        });
    });

    it('does not invent an interval when every append shares one timestamp', () => {
        expect(buildZaddyTimelineEntity(buffer(), [append(100, 'a'), append(100, 'b')]).entityType)
            .toBe('note');
    });

    it('falls back to the raw log when nobody summarized it', () => {
        expect(buildZaddyTimelineEntity(buffer(), [append(100, 'first'), append(400, 'second')]))
            .toMatchObject({ value: { content: 'first\nsecond' } });
    });
});

describe('observeZaddyTopic', () => {
    it('appends lines to one buffer instead of rewriting a summary', async () => {
        const { env, appends } = fakeEnv();
        const started = await observeZaddyTopic(env, {
            content: 'She started ripping out the static tokens.',
            observedAt: Date.now(),
        });
        expect(started.buffer).toMatchObject({ summary: '', appendCount: 1, status: 'open' });

        const continued = await observeZaddyTopic(env, {
            bufferId: started.buffer.id,
            content: 'The dashboard turned out to use OAuth already.',
            observedAt: Date.now(),
        });
        expect(continued.buffer).toMatchObject({ id: started.buffer.id, appendCount: 2 });
        expect(appends.map(row => row.content)).toEqual([
            'She started ripping out the static tokens.',
            'The dashboard turned out to use OAuth already.',
        ]);
    });

    it('rejects an append backdated beyond the window', async () => {
        const { env } = fakeEnv();
        await expect(observeZaddyTopic(env, {
            content: 'This actually started this morning.',
            observedAt: Date.now() - 6 * 60 * MINUTE,
        })).rejects.toThrow('15 minutes');
    });

    it('refuses to finalize without a summary', async () => {
        const { env } = fakeEnv();
        const started = await observeZaddyTopic(env, { content: 'A line.', observedAt: Date.now() });
        await expect(observeZaddyTopic(env, {
            bufferId: started.buffer.id,
            content: 'Another line.',
            observedAt: Date.now(),
            finalize: true,
        })).rejects.toThrow('summary');
    });

    it('finalizes a quiet buffer from its log without touching its span', async () => {
        const { env, buffers } = fakeEnv();
        const now = Date.now();
        const started = await observeZaddyTopic(env, { content: 'Opened.', observedAt: now - 10 * MINUTE });
        await observeZaddyTopic(env, {
            bufferId: started.buffer.id,
            content: 'Closed the loop.',
            observedAt: now - 4 * MINUTE,
        });

        const claimed = await observeZaddyTopic(env, {
            bufferId: started.buffer.id,
            summary: 'She finished the auth cleanup.',
            observedAt: now,
            finalize: true,
        });

        expect(claimed).toMatchObject({
            entity: {
                content: 'She finished the auth cleanup.',
                startAt: now - 10 * MINUTE,
                endAt: now - 4 * MINUTE,
            },
        });
        expect(buffers.get(started.buffer.id)?.status).toBe('closed');
    });

    it('hands back a buffer that went quiet, with its log, excluding the live one', async () => {
        const { env, buffers } = fakeEnv();
        const now = Date.now();
        const quiet = await observeZaddyTopic(env, { content: 'Earlier topic.', observedAt: now });
        buffers.set(quiet.buffer.id, {
            ...buffers.get(quiet.buffer.id)!,
            last_append_at: now - 20 * MINUTE,
        });

        const live = await observeZaddyTopic(env, { content: 'A new topic.', observedAt: now });
        expect(live).toMatchObject({
            pendingHandoff: [{ id: quiet.buffer.id, appends: [{ content: 'Earlier topic.' }] }],
        });
        expect(await collectZaddyHandoffs(env, now, quiet.buffer.id)).toEqual([]);
    });

    it('materializes an abandoned buffer as its raw log', async () => {
        const { env, buffers } = fakeEnv();
        const now = Date.now();
        const started = await observeZaddyTopic(env, { content: 'Nobody came back.', observedAt: now });
        buffers.set(started.buffer.id, {
            ...buffers.get(started.buffer.id)!,
            last_append_at: now - 25 * 60 * MINUTE,
        });

        expect(await expireAbandonedZaddyTopics(env, now)).toBe(1);
        expect(buffers.get(started.buffer.id)).toMatchObject({ status: 'closed', entity_type: 'note' });
    });
});
