import { describe, expect, it } from 'vitest';
import {
    applyRevisionMutations,
    MAX_MUTATIONS_PER_REQUEST,
    validateRevisionMutations,
    type RevisionMutation,
} from './_revisionSync.ts';

function fakeDb(tombstones: Array<{ entity_type: string; entity_id: string }> = []) {
    const batched: Array<{ sql: string; values: unknown[] }> = [];
    const db = {
        prepare(sql: string) {
            return {
                async first() { return { revision: 9 }; },
                async all() { return { results: [] }; },
                bind(...values: unknown[]) {
                    return {
                        sql,
                        values,
                        async first() { return { revision: 9 }; },
                        async all() {
                            return sql.includes('FROM sync_tombstones')
                                ? { results: tombstones }
                                : { results: [] };
                        },
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
                entityType: 'note',
                entityId: 'e1',
                operation: 'upsert',
                value: { id: 'e1', content: 'hello', timestamp: 1 },
            },
            { mutationId: 'm2', entityType: 'mediaItem', entityId: 'media-1', operation: 'delete' },
        ]);
        expect(result.accepted).toHaveLength(2);
        expect(result.rejected).toHaveLength(0);
    });

    it('rejects a bad mutation individually instead of failing the batch', () => {
        const result = validateRevisionMutations([
            {
                mutationId: 'bad',
                entityType: 'note',
                entityId: 'expected',
                operation: 'upsert',
                value: { id: 'different' },
            },
            { mutationId: 'good', entityType: 'note', entityId: 'e2', operation: 'delete' },
        ]);
        expect(result.accepted).toEqual([
            expect.objectContaining({ mutationId: 'good' }),
        ]);
        expect(result.rejected).toEqual([
            expect.objectContaining({
                mutationId: 'bad',
                reason: 'invalid',
                detail: expect.stringContaining('must match entityId'),
            }),
        ]);
    });

    it('rejects an invalid session value individually', () => {
        const result = validateRevisionMutations([{
            mutationId: 'legacy-session',
            entityType: 'session',
            entityId: 's1',
            operation: 'upsert',
            value: { id: 's1', content: 'work', startAt: 1, endAt: 'not-a-number' },
        }]);
        expect(result.accepted).toHaveLength(0);
        expect(result.rejected[0]).toMatchObject({
            mutationId: 'legacy-session',
            reason: 'invalid',
        });
    });

    it('still throws when a mutation cannot be identified for acknowledgement', () => {
        expect(() => validateRevisionMutations([{ entityType: 'note' }])).toThrow('invalid mutationId');
    });

    it('caps request size so the atomic D1 batch stays below 100 statements', () => {
        const mutations = Array.from({ length: MAX_MUTATIONS_PER_REQUEST + 1 }, (_, index) => ({
            mutationId: `m${index}`,
            entityType: 'note',
            entityId: `e${index}`,
            operation: 'delete',
        }));
        expect(() => validateRevisionMutations(mutations)).toThrow('at most');
    });
});

describe('applyRevisionMutations', () => {
    const upsertNote = (id: string): RevisionMutation => ({
        mutationId: `upsert-${id}`,
        entityType: 'note',
        entityId: id,
        operation: 'upsert',
        value: { id, content: 'hello', timestamp: 1 },
    });

    it('builds one atomic batch and acknowledges exact mutation IDs', async () => {
        const { db, batched } = fakeDb();
        const mutations: RevisionMutation[] = [
            upsertNote('e1'),
            {
                mutationId: 'delete-media',
                entityType: 'mediaItem',
                entityId: 'media-1',
                operation: 'delete',
            },
        ];

        const result = await applyRevisionMutations(db, mutations);
        expect(result).toMatchObject({
            revision: 9,
            appliedMutationIds: ['upsert-e1', 'delete-media'],
            rejectedMutations: [],
        });
        expect(result.lastModified).toEqual(expect.any(Number));
        // upsert: commit + insert; delete: commit + delete + tombstone; + sync_meta
        expect(batched).toHaveLength(6);
        expect(batched[0].sql).toContain('INSERT OR IGNORE INTO sync_commits');
        expect(batched.some(statement => statement.sql.includes('sync_tombstones'))).toBe(true);
        expect(batched.some(statement => statement.sql.includes('DELETE FROM sync_tombstones'))).toBe(false);
    });

    it('rejects an upsert for a tombstoned entity instead of resurrecting it', async () => {
        const { db, batched } = fakeDb([{ entity_type: 'note', entity_id: 'deleted-note' }]);
        const result = await applyRevisionMutations(db, [
            upsertNote('deleted-note'),
            upsertNote('live-note'),
        ]);

        expect(result.appliedMutationIds).toEqual(['upsert-live-note']);
        expect(result.rejectedMutations).toEqual([
            expect.objectContaining({
                mutationId: 'upsert-deleted-note',
                entityId: 'deleted-note',
                reason: 'deleted',
            }),
        ]);
        const upsertStatements = batched.filter(statement => statement.sql.includes('INSERT INTO notes'));
        expect(upsertStatements).toHaveLength(1);
        expect(upsertStatements[0].values).toContain('live-note');
    });

    it('keeps the tombstone guard inside the upsert statement itself', async () => {
        const { db, batched } = fakeDb();
        await applyRevisionMutations(db, [upsertNote('e1')]);
        const upsert = batched.find(statement => statement.sql.includes('INSERT INTO notes'));
        expect(upsert?.sql).toContain('NOT EXISTS');
        expect(upsert?.sql).not.toContain('tombstone.revision >');
    });

    it('runs no statements when every mutation is rejected', async () => {
        const { db, batched } = fakeDb([{ entity_type: 'note', entity_id: 'gone' }]);
        const result = await applyRevisionMutations(db, [upsertNote('gone')]);
        expect(result.appliedMutationIds).toEqual([]);
        expect(batched).toHaveLength(0);
    });
});
