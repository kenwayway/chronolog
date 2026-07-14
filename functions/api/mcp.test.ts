import { describe, expect, it } from 'vitest';
import { buildEntry, computeSessions, onRequestPost } from './mcp.ts';

describe('computeSessions', () => {
    it('derives duration from edited timestamps and uses the start category', () => {
        const sessions = computeSessions([
            { id: 'start', type: 'SESSION_START', timestamp: 1_000, category: 'hardware' },
            { id: 'end', type: 'SESSION_END', timestamp: 3_601_000, category: null },
        ]);

        expect(sessions).toEqual([
            {
                startId: 'start',
                startTimestamp: 1_000,
                category: 'hardware',
                durationMs: 3_600_000,
            },
        ]);
    });

    it('pairs consecutive sessions independently and ignores unmatched ends', () => {
        const sessions = computeSessions([
            { id: 'orphan-end', type: 'SESSION_END', timestamp: 500, category: null },
            { id: 'craft-start', type: 'SESSION_START', timestamp: 1_000, category: 'craft' },
            { id: 'craft-end', type: 'SESSION_END', timestamp: 61_000, category: null },
            { id: 'work-start', type: 'SESSION_START', timestamp: 120_000, category: 'work' },
            { id: 'work-end', type: 'SESSION_END', timestamp: 240_000, category: null },
        ]);

        expect(sessions.map(session => ({
            startId: session.startId,
            category: session.category,
            durationMs: session.durationMs,
        }))).toEqual([
            { startId: 'craft-start', category: 'craft', durationMs: 60_000 },
            { startId: 'work-start', category: 'work', durationMs: 120_000 },
        ]);
    });
});

describe('buildEntry', () => {
    it('normalizes tags and supports every optional Entry field', () => {
        const entry = buildEntry({
            id: 'custom-id',
            type: 'NOTE',
            content: 'Finished the migration',
            timestamp: '2026-07-14T09:30:00-04:00',
            category: 'craft',
            sessionId: 'manual-session',
            duration: 42,
            tags: ['#codex', ' codex ', 'release'],
            contentType: 'sparks',
            fieldValues: { source: 'MCP' },
            linkedEntries: ['older-entry'],
        }, 1, 'entry-id');

        expect(entry).toEqual({
            id: 'custom-id',
            type: 'NOTE',
            content: 'Finished the migration',
            timestamp: Date.parse('2026-07-14T09:30:00-04:00'),
            sessionId: 'manual-session',
            duration: 42,
            category: 'craft',
            tags: ['codex', 'release'],
            contentType: 'sparks',
            fieldValues: { source: 'MCP' },
            linkedEntries: ['older-entry'],
        });
    });

    it('defaults to now and rejects ambiguous timestamps or unknown categories', () => {
        expect(buildEntry({ content: 'Now' }, 123, 'id').timestamp).toBe(123);
        expect(() => buildEntry({ content: 'Bad time', timestamp: '2026-07-14T09:30:00' }))
            .toThrow('explicit UTC offset or Z');
        expect(() => buildEntry({ content: 'Bad category', category: 'other' }))
            .toThrow('Unknown category');
    });

    it('requires a structured content type when fieldValues are provided', () => {
        expect(() => buildEntry({ content: 'Invalid fields', fieldValues: { energy: 3 } }))
            .toThrow('fieldValues requires a non-note contentType');
    });

    it('generates session IDs for starts and allows empty session boundary content', () => {
        expect(buildEntry(
            { type: 'SESSION_START' },
            123,
            'start-id',
            'generated-session-id',
        )).toEqual({
            id: 'start-id',
            type: 'SESSION_START',
            content: '',
            timestamp: 123,
            sessionId: 'generated-session-id',
        });
        expect(buildEntry({ type: 'SESSION_END', duration: 60_000 }, 456, 'end-id')).toEqual({
            id: 'end-id',
            type: 'SESSION_END',
            content: '',
            timestamp: 456,
            duration: 60_000,
        });
    });
});

describe('MCP write permissions', () => {
    async function requestMcp(token: string, body: unknown, db?: D1Database) {
        const context = {
            request: new Request('https://chronolog.test/api/mcp', {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(body),
            }),
            env: {
                CHRONOLOG_DB: db,
                PUBLIC_API_TOKEN: 'read-token',
                MCP_WRITE_TOKEN: 'write-token',
            },
        } as unknown as Parameters<typeof onRequestPost>[0];
        return onRequestPost(context);
    }

    it('only advertises add_entry to clients using the write token', async () => {
        const request = { jsonrpc: '2.0', id: 1, method: 'tools/list' };
        const readBody = await (await requestMcp('read-token', request)).json() as {
            result: { tools: Array<{ name: string }> };
        };
        const writeBody = await (await requestMcp('write-token', request)).json() as {
            result: { tools: Array<{ name: string }> };
        };

        expect(readBody.result.tools.map(tool => tool.name)).not.toContain('add_entry');
        expect(writeBody.result.tools.map(tool => tool.name)).toContain('add_entry');
    });

    it('rejects direct add_entry calls made with the read token', async () => {
        const response = await requestMcp('read-token', {
            jsonrpc: '2.0',
            id: 2,
            method: 'tools/call',
            params: { name: 'add_entry', arguments: { content: 'Should not write' } },
        });
        const body = await response.json() as {
            result: { isError: boolean; content: Array<{ text: string }> };
        };

        expect(body.result.isError).toBe(true);
        expect(body.result.content[0].text).toContain('MCP_WRITE_TOKEN');
    });

    it('writes an entry and advances the sync cursor with the write token', async () => {
        const batches: unknown[][] = [];
        const runs: Array<{ sql: string; values: unknown[] }> = [];
        const db = {
            prepare(sql: string) {
                return {
                    bind(...values: unknown[]) {
                        return {
                            sql,
                            values,
                            async first() {
                                return null;
                            },
                            async run() {
                                runs.push({ sql, values });
                                return { success: true };
                            },
                        };
                    },
                };
            },
            async batch(statements: unknown[]) {
                batches.push(statements);
                return statements.map(() => ({ meta: { changes: 1 } }));
            },
        } as unknown as D1Database;

        const response = await requestMcp('write-token', {
            jsonrpc: '2.0',
            id: 3,
            method: 'tools/call',
            params: {
                name: 'add_entry',
                arguments: { content: 'Written through MCP', category: 'craft', tags: ['#mcp'] },
            },
        }, db);
        const body = await response.json() as {
            result: { isError?: boolean; content: Array<{ text: string }> };
        };
        const data = JSON.parse(body.result.content[0].text) as {
            success: boolean;
            entry: { content: string; category: string; tags: string[] };
            lastModified: number;
        };

        expect(body.result.isError).not.toBe(true);
        expect(data.success).toBe(true);
        expect(data.entry).toMatchObject({ content: 'Written through MCP', category: 'craft', tags: ['mcp'] });
        expect(batches).toHaveLength(1);
        const batchedStatements = batches.flat() as Array<{ sql: string }>;
        expect(batchedStatements.some(statement => statement.sql.includes('sync_meta'))).toBe(true);
        expect(runs).toHaveLength(0);
        expect(data.lastModified).toEqual(expect.any(Number));
    });

    it('calculates SESSION_END duration from the latest open session', async () => {
        const batches: unknown[][] = [];
        const db = {
            prepare(sql: string) {
                return {
                    bind(...values: unknown[]) {
                        return {
                            sql,
                            values,
                            async first() {
                                if (sql.includes("type IN ('SESSION_START', 'SESSION_END')")) {
                                    return { id: 'start', type: 'SESSION_START', timestamp: 1_000, category: 'craft' };
                                }
                                return null;
                            },
                        };
                    },
                };
            },
            async batch(statements: unknown[]) {
                batches.push(statements);
                return statements.map(() => ({ meta: { changes: 1 } }));
            },
        } as unknown as D1Database;

        const response = await requestMcp('write-token', {
            jsonrpc: '2.0',
            id: 4,
            method: 'tools/call',
            params: {
                name: 'add_entry',
                arguments: { type: 'SESSION_END', timestamp: '1970-01-01T00:00:03Z' },
            },
        }, db);
        const body = await response.json() as { result: { content: Array<{ text: string }> } };
        const data = JSON.parse(body.result.content[0].text) as {
            entry: { type: string; durationMs: number };
        };

        expect(data.entry).toMatchObject({ type: 'SESSION_END', durationMs: 2_000 });
        expect(batches).toHaveLength(1);
    });

    it('updates linked entries bidirectionally in the atomic write batch', async () => {
        const batches: unknown[][] = [];
        const linkedRow = {
            id: 'older-entry',
            type: 'NOTE',
            content: 'Older',
            timestamp: 1,
            session_id: null,
            duration: null,
            category: null,
            content_type: 'note',
            field_values: null,
            linked_entries: null,
            tags: null,
            created_at: 1,
            updated_at: 1,
        };
        const db = {
            prepare(sql: string) {
                return {
                    bind(...values: unknown[]) {
                        return {
                            sql,
                            values,
                            async first() { return null; },
                            async all() { return { results: [linkedRow] }; },
                        };
                    },
                };
            },
            async batch(statements: unknown[]) {
                batches.push(statements);
                return statements.map(() => ({ meta: { changes: 1 } }));
            },
        } as unknown as D1Database;

        const response = await requestMcp('write-token', {
            jsonrpc: '2.0',
            id: 5,
            method: 'tools/call',
            params: {
                name: 'add_entry',
                arguments: { id: 'new-entry', content: 'New', linkedEntries: ['older-entry'] },
            },
        }, db);
        const body = await response.json() as { result: { content: Array<{ text: string }> } };
        const data = JSON.parse(body.result.content[0].text) as { success: boolean };
        const statements = batches[0] as Array<{ values: unknown[] }>;

        expect(data.success).toBe(true);
        expect(statements).toHaveLength(3); // new entry, linked entry, sync metadata
        expect(JSON.parse(statements[0].values[9] as string)).toEqual(['older-entry']);
        expect(JSON.parse(statements[1].values[9] as string)).toEqual(['new-entry']);
    });
});
