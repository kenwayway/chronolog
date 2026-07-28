import { describe, expect, it, vi } from 'vitest';

vi.mock('./_notionSync.ts', () => ({
    applyMutationsWithNotionSync: vi.fn(async () => ({
        revision: 1,
        appliedMutationIds: [],
        rejectedMutations: [],
    })),
}));

import { buildZaddyTimelineEntity, observeZaddyTopic } from './_zaddyObservation.ts';
import type { Env, ZaddyTopicBufferRow } from './types.ts';

function buffer(overrides: Partial<ZaddyTopicBufferRow> = {}): ZaddyTopicBufferRow {
    return {
        id: 'buffer-1',
        content: 'You kept returning to the sync boundary.',
        first_observed_at: 100,
        last_observed_at: 100,
        observation_count: 1,
        category: null,
        status: 'open',
        entity_type: null,
        entity_id: null,
        created_at: 100,
        updated_at: 100,
        ...overrides,
    };
}

function fakeEnv() {
    const rows = new Map<string, ZaddyTopicBufferRow>();
    const db = {
        prepare(sql: string) {
            let values: unknown[] = [];
            const statement = {
                bind(...next: unknown[]) {
                    values = next;
                    return statement;
                },
                async all() {
                    if (sql.includes("status = 'open' AND last_observed_at <")) {
                        return { results: [] };
                    }
                    return { results: [] };
                },
                async first() {
                    return rows.get(String(values[0])) ?? null;
                },
                async run() {
                    if (sql.includes('INSERT INTO zaddy_topic_buffers')) {
                        rows.set(String(values[0]), {
                            id: String(values[0]),
                            content: String(values[1]),
                            first_observed_at: Number(values[2]),
                            last_observed_at: Number(values[3]),
                            observation_count: 1,
                            category: values[4] as string | null,
                            status: 'open',
                            entity_type: null,
                            entity_id: null,
                            created_at: Number(values[5]),
                            updated_at: Number(values[6]),
                        });
                    } else if (sql.includes('observation_count = observation_count + 1')) {
                        const id = String(values[5]);
                        const current = rows.get(id)!;
                        rows.set(id, {
                            ...current,
                            content: String(values[0]),
                            first_observed_at: Number(values[1]),
                            last_observed_at: Number(values[2]),
                            observation_count: current.observation_count + 1,
                            category: values[3] as string | null,
                            updated_at: Number(values[4]),
                        });
                    }
                    return { success: true };
                },
            };
            return statement;
        },
    } as unknown as D1Database;
    return {
        env: { CHRONOLOG_DB: db } as Env,
        rows,
    };
}

describe('buildZaddyTimelineEntity', () => {
    it('materializes a single observation as a zaddy note', () => {
        expect(buildZaddyTimelineEntity(buffer())).toEqual({
            entityType: 'note',
            value: {
                id: 'zaddy:buffer-1',
                content: 'You kept returning to the sync boundary.',
                timestamp: 100,
                origin: 'zaddy',
            },
        });
    });

    it('materializes a continued topic as a closed historical zaddy session', () => {
        expect(buildZaddyTimelineEntity(buffer({
            last_observed_at: 400,
            observation_count: 3,
            category: 'craft',
        }))).toEqual({
            entityType: 'session',
            value: {
                id: 'zaddy:buffer-1',
                content: 'You kept returning to the sync boundary.',
                startAt: 100,
                endAt: 400,
                category: 'craft',
                origin: 'zaddy',
            },
        });
    });

    it('honors a backdated first observation even when the buffer was created late', () => {
        expect(buildZaddyTimelineEntity(buffer({
            first_observed_at: 50,
        })).entityType).toBe('session');
    });

    it('does not invent a non-zero interval when repeated observations share one timestamp', () => {
        expect(buildZaddyTimelineEntity(buffer({ observation_count: 2 })).entityType).toBe('note');
    });
});

describe('observeZaddyTopic', () => {
    it('starts a durable buffer and continues it by returned ID', async () => {
        const { env, rows } = fakeEnv();
        const started = await observeZaddyTopic(env, {
            content: 'The sync problem keeps returning.',
            observedAt: 200,
            firstObservedAt: 100,
        });
        expect(started.buffer).toMatchObject({
            content: 'The sync problem keeps returning.',
            firstObservedAt: 100,
            lastObservedAt: 200,
            observationCount: 1,
            status: 'open',
        });

        const continued = await observeZaddyTopic(env, {
            bufferId: started.buffer.id,
            content: 'The cursor timing became the likely cause.',
            observedAt: 300,
        });
        expect(continued.buffer).toMatchObject({
            id: started.buffer.id,
            content: 'The cursor timing became the likely cause.',
            firstObservedAt: 100,
            lastObservedAt: 300,
            observationCount: 2,
        });
        expect(rows.get(started.buffer.id)?.content).toBe('The cursor timing became the likely cause.');
    });
});
