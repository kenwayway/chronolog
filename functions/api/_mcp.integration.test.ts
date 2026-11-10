/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { URL } from 'node:url';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import { handleMcpRequest } from './_mcp.ts';
import { applyRevisionMutations } from './_revisionSync.ts';
import type { Env, Note, Session } from './types.ts';

// Execute the real mutation SQL and FTS triggers against an isolated database.
// No Cloudflare credentials, production data, or network writes are involved.
function sqliteEnv() {
    const sqlite = new DatabaseSync(':memory:');
    sqlite.exec(readFileSync(new URL('../../schema.sql', import.meta.url), 'utf8'));
    function prepare(sql: string) {
        let values: SQLInputValue[] = [];
        return {
            bind(...args: SQLInputValue[]) { values = args; return this; },
            async first() { return sqlite.prepare(sql).get(...values) ?? null; },
            async all() { return { results: sqlite.prepare(sql).all(...values), success: true }; },
            async run() { return { meta: sqlite.prepare(sql).run(...values), success: true }; },
        };
    }
    const db = {
        prepare,
        async batch(statements: ReturnType<typeof prepare>[]) {
            sqlite.exec('BEGIN');
            try {
                const results = [];
                for (const statement of statements) results.push(await statement.run());
                sqlite.exec('COMMIT');
                return results;
            } catch (error) {
                sqlite.exec('ROLLBACK');
                throw error;
            }
        },
    } as unknown as D1Database;
    return { sqlite, env: { CHRONOLOG_DB: db } as Env };
}

async function call(env: Env, name: string, args: Record<string, unknown>, canWrite = true) {
    const response = await handleMcpRequest(new Request('https://test.invalid/mcp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }),
    }), env, canWrite);
    return response.json<{ error?: unknown; result?: { isError?: boolean } }>();
}

async function seed(env: Env, entityType: 'note' | 'session', value: Note | Session) {
    await applyRevisionMutations(env.CHRONOLOG_DB, [{
        mutationId: crypto.randomUUID(), entityType, entityId: value.id, operation: 'upsert', value,
    }]);
}

function successful(body: Awaited<ReturnType<typeof call>>) {
    expect(body.error).toBeUndefined();
    expect(body.result).toBeDefined();
    expect(body.result?.isError).not.toBe(true);
}

// Tool argument contracts are deliberately exercised through JSON-RPC, not just builders.
describe('MCP entry mutation SQLite integration', () => {
    it('leaves the database untouched for read-only access and unconfirmed deletion', async () => {
        const { sqlite, env } = sqliteEnv();
        try {
            await seed(env, 'note', { id: 'protected', content: 'unchanged', timestamp: 1000 });
            const before = sqlite.prepare('SELECT MAX(revision) AS n FROM sync_commits').get();
            for (const [name, args, canWrite] of [
                ['edit_entry', { entityType: 'note', id: 'protected', changes: { content: 'bad' } }, false],
                ['delete_entry', { entityType: 'note', id: 'protected', confirm: true }, false],
                ['delete_entry', { entityType: 'note', id: 'protected' }, true],
            ] as const) {
                const result = await call(env, name, args, canWrite);
                expect(Boolean(result.error) || result.result?.isError === true).toBe(true);
            }
            expect(sqlite.prepare('SELECT MAX(revision) AS n FROM sync_commits').get()).toEqual(before);
            expect(sqlite.prepare('SELECT content FROM notes WHERE id = ?').get('protected')).toMatchObject({ content: 'unchanged' });
        } finally { sqlite.close(); }
    });
    it('edits a note, updates FTS, deletes with a tombstone, and prevents stale resurrection', async () => {
        const { sqlite, env } = sqliteEnv();
        try {
            const original: Note = { id: 'integration-note', content: 'originalword', timestamp: 1000, tags: ['keep'], category: 'craft' };
            await seed(env, 'note', original);
            successful(await call(env, 'edit_entry', {
                entityType: 'note', id: original.id, changes: { content: 'replacementword' },
            }));
            const edited = sqlite.prepare('SELECT * FROM notes WHERE id = ?').get(original.id);
            expect(edited).toMatchObject({ content: 'replacementword', timestamp: 1000, tags: '["keep"]', category: 'craft' });
            expect(sqlite.prepare("SELECT COUNT(*) AS n FROM notes_fts WHERE notes_fts MATCH 'replacementword'").get()).toMatchObject({ n: 1 });
            expect(sqlite.prepare("SELECT COUNT(*) AS n FROM notes_fts WHERE notes_fts MATCH 'originalword'").get()).toMatchObject({ n: 0 });
            successful(await call(env, 'delete_entry', { entityType: 'note', id: original.id, confirm: true }));
            expect(sqlite.prepare('SELECT * FROM notes WHERE id = ?').get(original.id)).toBeUndefined();
            expect(sqlite.prepare('SELECT * FROM sync_tombstones WHERE entity_id = ?').get(original.id)).toMatchObject({ entity_type: 'note' });
            expect(sqlite.prepare("SELECT COUNT(*) AS n FROM notes_fts WHERE notes_fts MATCH 'replacementword'").get()).toMatchObject({ n: 0 });
            const stale = await applyRevisionMutations(env.CHRONOLOG_DB, [{ mutationId: 'stale-device', entityType: 'note', entityId: original.id, operation: 'upsert', value: original }]);
            expect(stale.rejectedMutations).toHaveLength(1);
            expect(stale.rejectedMutations[0].reason).toBe('deleted');
            expect(sqlite.prepare('SELECT * FROM notes WHERE id = ?').get(original.id)).toBeUndefined();
        } finally { sqlite.close(); }
    });

    it('edits/deletes a whole session without cascading to its notes', async () => {
        const { sqlite, env } = sqliteEnv();
        try {
            const session: Session = { id: 'integration-session', content: 'work', startAt: 1000, endAt: 2000, endContent: 'done' };
            await seed(env, 'session', session);
            await seed(env, 'note', { id: 'attached-note', content: 'preserve me', timestamp: 1500, sessionId: session.id });
            successful(await call(env, 'edit_entry', { entityType: 'session', id: session.id, changes: { endAt: '1970-01-01T00:00:03Z' } }));
            expect(sqlite.prepare('SELECT * FROM sessions WHERE id = ?').get(session.id)).toMatchObject({ start_at: 1000, end_at: 3000, end_content: 'done' });
            successful(await call(env, 'delete_entry', { entityType: 'session', id: session.id, confirm: true }));
            expect(sqlite.prepare('SELECT * FROM sessions WHERE id = ?').get(session.id)).toBeUndefined();
            expect(sqlite.prepare('SELECT * FROM notes WHERE id = ?').get('attached-note')).toMatchObject({ content: 'preserve me' });
        } finally { sqlite.close(); }
    });
});
