import { describe, expect, it } from 'vitest';
import {
    applyRevisionMutations,
    MAX_MUTATIONS_PER_REQUEST,
    validateRevisionMutations,
    type RevisionMutation,
} from './_revisionSync.ts';

function fakeDb() {
    const batched: Array<{ sql: string; values: unknown[] }> = [];
    const db = {
        prepare(sql: string) {
            return {
                bind(...values: unknown[]) {
                    return {
                        sql,
                        values,
                        async first() { return { revision: 9 }; },
                    };
                },
            };
        },
        async batch(statements: Array<{ sql: string; values: unknown[] }>) {
            batched.push(...statements);
            return statements.map(() => ({ success: true }));
        },
    } as unknown as D1Database;
    return { db, batched };
}

describe('revision sync validation', () => {
    it('accepts a matching upsert and a delete', () => {
        const result = validateRevisionMutations([
            {
                mutationId: 'm1',
                entityType: 'entry',
                entityId: 'e1',
                operation: 'upsert',
                value: { id: 'e1', type: 'NOTE', content: 'hello', timestamp: 1 },
            },
            { mutationId: 'm2', entityType: 'mediaItem', entityId: 'media-1', operation: 'delete' },
        ]);
        expect(result).toHaveLength(2);
    });

    it('rejects a mismatched upsert value', () => {
        expect(() => validateRevisionMutations([{
            mutationId: 'm1',
            entityType: 'entry',
            entityId: 'expected',
            operation: 'upsert',
            value: { id: 'different' },
        }])).toThrow('must match entityId');
    });

    it('caps request size so the atomic D1 batch stays below 100 statements', () => {
        const mutations = Array.from({ length: MAX_MUTATIONS_PER_REQUEST + 1 }, (_, index) => ({
            mutationId: `m${index}`,
            entityType: 'entry',
            entityId: `e${index}`,
            operation: 'delete',
        }));
        expect(() => validateRevisionMutations(mutations)).toThrow('at most');
    });
});

describe('applyRevisionMutations', () => {
    it('builds one atomic batch and acknowledges exact mutation IDs', async () => {
        const { db, batched } = fakeDb();
        const mutations: RevisionMutation[] = [
            {
                mutationId: 'upsert-entry',
                entityType: 'entry',
                entityId: 'e1',
                operation: 'upsert',
                value: { id: 'e1', type: 'NOTE', content: 'hello', timestamp: 1 },
            },
            {
                mutationId: 'delete-media',
                entityType: 'mediaItem',
                entityId: 'media-1',
                operation: 'delete',
            },
        ];

        const result = await applyRevisionMutations(db, mutations);
        expect(result).toMatchObject({ revision: 9, appliedMutationIds: ['upsert-entry', 'delete-media'] });
        expect(result.lastModified).toEqual(expect.any(Number));
        expect(batched).toHaveLength(7);
        expect(batched[0].sql).toContain('INSERT OR IGNORE INTO sync_commits');
        expect(batched.some(statement => statement.sql.includes('sync_tombstones'))).toBe(true);
        expect(batched.some(statement => statement.sql.includes('deleted_entries'))).toBe(false);
    });
});
