import { describe, expect, it } from 'vitest';
import { buildNoteEntry, computeSessions, onRequestPost } from './mcp.ts';

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

describe('buildNoteEntry', () => {
    it('normalizes tags and builds a structured note', () => {
        const entry = buildNoteEntry({
            content: 'Finished the migration',
            timestamp: '2026-07-14T09:30:00-04:00',
            category: 'craft',
            tags: ['#codex', ' codex ', 'release'],
            contentType: 'sparks',
            fieldValues: { source: 'MCP' },
        }, 1, 'entry-id');

        expect(entry).toEqual({
            id: 'entry-id',
            type: 'NOTE',
            content: 'Finished the migration',
            timestamp: Date.parse('2026-07-14T09:30:00-04:00'),
            category: 'craft',
            tags: ['codex', 'release'],
            contentType: 'sparks',
            fieldValues: { source: 'MCP' },
        });
    });

    it('defaults to now and rejects ambiguous timestamps or unknown categories', () => {
        expect(buildNoteEntry({ content: 'Now' }, 123, 'id').timestamp).toBe(123);
        expect(() => buildNoteEntry({ content: 'Bad time', timestamp: '2026-07-14T09:30:00' }))
            .toThrow('explicit UTC offset or Z');
        expect(() => buildNoteEntry({ content: 'Bad category', category: 'other' }))
            .toThrow('Unknown category');
    });

    it('requires a structured content type when fieldValues are provided', () => {
        expect(() => buildNoteEntry({ content: 'Invalid fields', fieldValues: { energy: 3 } }))
            .toThrow('fieldValues requires a non-note contentType');
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
});
