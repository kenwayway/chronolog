import { describe, expect, it } from 'vitest';
import { buildEntryEdit, handleMcpRequest } from './_mcp.ts';
import { noteObjectToRow, sessionObjectToRow } from './_db.ts';
import type { Env, Note, Session } from './types.ts';

const note: Note = {
    id: 'n1', content: 'original', timestamp: 1000, sessionId: 's1',
    category: 'craft', contentType: 'custom', fieldValues: { a: 1, b: 'keep' },
    tags: ['keep'], linkedItems: ['s1'], origin: 'zaddy',
};
const session: Session = {
    id: 's1', content: 'work', startAt: 1000, endAt: 5000,
    endContent: 'done', endTags: ['end'], tags: ['start'], category: 'work',
    fieldValues: { a: 1 }, linkedItems: ['n1'], origin: 'zaddy',
};
const oldPage = '12345678-90ab-cdef-1234-567890abcdef';
const newPage = 'abcdef12-3456-7890-abcd-ef1234567890';

describe('partial entry edits', () => {
    it.each([['note', note], ['session', session]] as const)('preserves every untouched %s field without mutating input', (type, original) => {
        const before = structuredClone(original);
        expect(buildEntryEdit(type, original, { content: '  updated  ' })).toEqual({ ...original, content: 'updated' });
        expect(original).toEqual(before);
    });
    it('clears optional metadata and replaces arrays and objects', () => {
        const updated = buildEntryEdit('note', note, { category: null, contentType: null, sessionId: null, tags: [], fieldValues: { c: 3 } });
        expect(updated).toEqual({ id: 'n1', content: 'original', timestamp: 1000, tags: [], fieldValues: { c: 3 }, linkedItems: ['s1'], origin: 'zaddy' });
        expect(buildEntryEdit('session', session, { endContent: null, endTags: [], fieldValues: null })).toEqual({
            id: 's1', content: 'work', startAt: 1000, endAt: 5000, tags: ['start'], category: 'work', endTags: [], linkedItems: ['n1'], origin: 'zaddy',
        });
    });
    it('normalizes tags and parses offset timestamps', () => {
        expect(buildEntryEdit('note', note, { tags: ['#one', 'one', ' two '], timestamp: '2026-10-10T09:00:00-04:00' })).toMatchObject({ tags: ['one', 'two'], timestamp: Date.parse('2026-10-10T13:00:00Z') });
    });
    it('closes open sessions and accepts zero duration but never reopens', () => {
        expect(buildEntryEdit('session', { ...session, endAt: null }, { endAt: '1970-01-01T00:00:01Z' })).toMatchObject({ endAt: 1000 });
        expect(() => buildEntryEdit('session', session, { endAt: null })).toThrow('ISO');
        expect(() => buildEntryEdit('session', session, { startAt: '1970-01-01T00:00:06Z' })).toThrow('before');
        expect(() => buildEntryEdit('session', session, { endAt: '1970-01-01T00:00:00Z' })).toThrow('before');
    });
    it.each([
        {}, null, [], 'bad', { typo: true }, { id: 'other' }, { origin: 'zaddy' }, { linkedItems: [] },
        { content: '' }, { content: null }, { content: 'x'.repeat(100001) },
        { category: 'invalid' }, { tags: null }, { tags: [1] }, { tags: Array(31).fill('x') },
        { contentType: 1 }, { contentType: '' }, { contentType: 'x'.repeat(101) },
        { fieldValues: [] }, { fieldValues: 'bad' }, { sessionId: '' }, { sessionId: 'session:s1:start' },
        { startAt: '1970-01-01T00:00:00Z' }, { endTags: [] }, { endContent: 'x' },
        { timestamp: null }, { timestamp: 1 }, { timestamp: '2026-10-10' },
        { timestamp: '2026-10-10T09:00:00' }, { timestamp: '2026-02-30T09:00:00Z' },
        { timestamp: '2026-10-10T24:00:00Z' }, { timestamp: '2026-10-10T09:00:00+99:00' },
        { contentType: 'notion-task', fieldValues: { notionPageId: oldPage } }, { contentType: 'zaddy-comment' },
    ])('rejects invalid note changes %j', changes => {
        expect(() => buildEntryEdit('note', note, changes)).toThrow();
    });
    it.each([{ timestamp: '1970-01-01T00:00:00Z' }, { sessionId: 's1' }, { endTags: [false] }, { endContent: false }])('rejects invalid session changes %j', changes => {
        expect(() => buildEntryEdit('session', session, changes)).toThrow();
    });
    it('validates merged Notion fields and normalizes page IDs', () => {
        const task = { ...session, contentType: 'notion-task', fieldValues: { notionPageId: oldPage, custom: 1 } };
        expect(buildEntryEdit('session', task, { content: 'new' })).toEqual({ ...task, content: 'new' });
        expect(buildEntryEdit('session', task, { fieldValues: { notionPageId: newPage.replaceAll('-', '') } })).toMatchObject({ fieldValues: { notionPageId: newPage } });
        expect(() => buildEntryEdit('session', task, { fieldValues: null })).toThrow('notionPageId');
        expect(() => buildEntryEdit('session', session, { contentType: 'notion-task' })).toThrow('notionPageId');
    });
    it('preserves comment invariants', () => {
        const comment = { ...note, contentType: 'zaddy-comment', linkedItems: ['s1'] };
        expect(buildEntryEdit('note', comment, { content: 'fixed' })).toEqual({ ...comment, content: 'fixed' });
        expect(() => buildEntryEdit('note', comment, { category: 'work' })).toThrow('Comments');
        expect(() => buildEntryEdit('note', comment, { contentType: null })).toThrow('Comments');
    });
});

// Capture the real revision/Notion SQL path, without any remote bindings or HTTP.
function entryDb(options: { missing?: boolean; tombstoned?: boolean; task?: boolean } = {}) {
    const batched: Array<{ sql: string; values: unknown[] }> = [];
    const reads: string[] = [];
    const noteRow = noteObjectToRow(note);
    const sessionRow = sessionObjectToRow(options.task ? { ...session, contentType: 'notion-task', fieldValues: { notionPageId: oldPage } } : session);
    const db = {
        prepare(sql: string) {
            reads.push(sql);
            const statement = {
                sql, values: [] as unknown[],
                bind(...values: unknown[]) { statement.values = values; return statement; },
                async first() {
                    if (sql.includes('MAX(revision)')) return { revision: 10 };
                    if (sql.includes('FROM notion_sync_jobs')) return { pending: 1, failed: 0 };
                    if (options.missing) return null;
                    if (sql === 'SELECT * FROM notes WHERE id = ?' && statement.values[0] === 'n1') return noteRow;
                    if (sql === 'SELECT * FROM sessions WHERE id = ?' && statement.values[0] === 's1') return sessionRow;
                    return null;
                },
                async all() {
                    if (sql.includes('FROM sync_tombstones') && options.tombstoned) return { results: [{ entity_type: 'note', entity_id: 'n1' }] };
                    if (sql.includes('FROM sessions WHERE id IN')) return { results: [sessionRow] };
                    return { results: [] };
                },
            };
            return statement;
        },
        async batch(statements: Array<{ sql: string; values: unknown[] }>) {
            batched.push(...statements);
            return statements.map(() => ({ success: true }));
        },
    } as unknown as D1Database;
    return { db, batched, reads };
}
async function call(name: string, args: unknown, db: D1Database, canWrite = true) {
    const response = await handleMcpRequest(new Request('https://test/mcp', {
        method: 'POST', body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }),
    }), { CHRONOLOG_DB: db } as Env, canWrite);
    const body = await response.json<{ result: { isError?: boolean; content: Array<{ text: string }> } }>();
    return body.result;
}

describe('edit_entry and delete_entry MCP integration', () => {
    it.each(['edit_entry', 'delete_entry'])('gates %s before reading the database', async name => {
        const { db, reads, batched } = entryDb();
        const result = await call(name, { id: 'n1', entityType: 'note', confirm: true, changes: { content: 'new' } }, db, false);
        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain('chronolog:write');
        expect(reads).toEqual([]); expect(batched).toEqual([]);
    });
    it.each([['note', 'n1', 'notes'], ['session', 's1', 'sessions']])('edits %s via one canonical revision mutation', async (entityType, id, table) => {
        const { db, batched } = entryDb();
        const result = await call('edit_entry', { entityType, id, changes: { content: 'fixed' } }, db);
        expect(result.isError).toBeUndefined();
        expect(JSON.parse(result.content[0].text)).toMatchObject({ [entityType]: { id, content: 'fixed', origin: 'zaddy', linkedItems: entityType === 'note' ? ['s1'] : ['n1'] }, revision: 10 });
        expect(batched.filter(s => s.sql.includes('INSERT OR IGNORE INTO sync_commits'))).toHaveLength(1);
        const upsert = batched.find(s => s.sql.includes(`INSERT INTO ${table}`));
        expect(upsert?.values.slice(0, 2)).toEqual([id, 'fixed']);
        expect(upsert?.sql).toContain('NOT EXISTS');
    });
    it.each([['note', 'n1', 'notes'], ['session', 's1', 'sessions']])('deletes %s with a tombstone, without cascading', async (entityType, id, table) => {
        const { db, batched } = entryDb();
        const result = await call('delete_entry', { entityType, id, confirm: true }, db);
        expect(result.isError).toBeUndefined();
        expect(JSON.parse(result.content[0].text)).toEqual({ deleted: true, entityType, id, revision: 10 });
        expect(batched.filter(s => s.sql.includes('DELETE FROM'))).toHaveLength(1);
        expect(batched.find(s => s.sql.includes(`DELETE FROM ${table}`))?.values[0]).toBe(id);
        expect(batched.find(s => s.sql.includes('INSERT INTO sync_tombstones'))?.values.slice(0, 2)).toEqual([entityType, id]);
        expect(batched.filter(s => s.sql.includes('sync_commits ('))).toHaveLength(1);
    });
    it.each([undefined, false, 'true', 1])('requires literal confirmation: %j', async confirm => {
        const { db, reads, batched } = entryDb();
        expect((await call('delete_entry', { entityType: 'note', id: 'n1', confirm }, db)).isError).toBe(true);
        expect(reads).toEqual([]); expect(batched).toEqual([]);
    });
    it.each(['edit_entry', 'delete_entry'])('rejects invalid %s targets and extra keys without writes', async name => {
        for (const target of [
            { entityType: 'note', id: 'missing' }, { entityType: 'note', id: 's1' },
            { entityType: 'session-start', id: 's1' }, { entityType: 'session', id: 'session:s1:end' },
            { entityType: 'mediaItem', id: 'n1' }, { entityType: 'note', id: '' },
            { entityType: 'note', id: 'n1', extra: true },
        ]) {
            const { db, batched } = entryDb();
            const args = { ...target, ...(name === 'edit_entry' ? { changes: { content: 'new' } } : { confirm: true }) };
            expect((await call(name, args, db)).isError).toBe(true);
            expect(batched).toEqual([]);
        }
    });
    it('validates note ownership and empty edits without writes', async () => {
        for (const changes of [{ sessionId: 'n1' }, {}, { timestamp: 'bad' }, { linkedItems: [] }]) {
            const { db, batched } = entryDb();
            expect((await call('edit_entry', { entityType: 'note', id: 'n1', changes }, db)).isError).toBe(true);
            expect(batched).toEqual([]);
        }
        const { db } = entryDb();
        expect((await call('edit_entry', { entityType: 'note', id: 'n1', changes: { sessionId: 's1' } }, db)).isError).toBeUndefined();
    });
    it('reports tombstone rejection instead of claiming a successful edit', async () => {
        const { db, batched } = entryDb({ tombstoned: true });
        const result = await call('edit_entry', { entityType: 'note', id: 'n1', changes: { content: 'new' } }, db);
        expect(result.isError).toBe(true); expect(result.content[0].text).toContain('deleted'); expect(batched).toEqual([]);
    });
    it.each(['edit_entry', 'delete_entry'])('keeps the durable Notion queue for %s', async name => {
        const { db, batched } = entryDb({ task: true });
        const result = await call(name, { entityType: 'session', id: 's1', ...(name === 'edit_entry' ? { changes: { fieldValues: { notionPageId: newPage } } } : { confirm: true }) }, db);
        expect(result.isError).toBeUndefined();
        expect(JSON.parse(result.content[0].text).notionSync).toEqual({ pending: 1, failed: 0 });
        const pages = batched.filter(s => s.sql.includes('INSERT INTO notion_sync_jobs')).map(s => s.values[0]);
        expect(pages).toEqual(name === 'edit_entry' ? [oldPage, newPage] : [oldPage]);
    });
});
