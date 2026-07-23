import { describe, expect, it } from 'vitest';
import { buildNote, buildSession, onRequestPost } from './mcp.ts';
import type { Env } from './types.ts';

describe('MCP domain builders', () => {
    it('builds notes without a wire entry type', () => {
        expect(buildNote({
            content: 'Remember this',
            category: 'craft',
            tags: ['#idea'],
        }, 123, 'note-1')).toEqual({
            id: 'note-1',
            content: 'Remember this',
            timestamp: 123,
            category: 'craft',
            contentType: undefined,
            fieldValues: undefined,
            tags: ['idea'],
            linkedItems: undefined,
        });
    });

    it('builds open sessions as first-class intervals', () => {
        expect(buildSession({
            content: 'Deep work',
            timestamp: '2026-07-23T09:00:00-04:00',
        }, 0, 'session-1')).toMatchObject({
            id: 'session-1',
            content: 'Deep work',
            startAt: Date.parse('2026-07-23T09:00:00-04:00'),
            endAt: null,
        });
    });

    it('rejects notion tasks on notes', () => {
        expect(() => buildNote({
            content: 'bad',
            contentType: 'notion-task',
            fieldValues: { notionPageId: '1234567890abcdef1234567890abcdef' },
        })).toThrow('session');
    });
});

function context(token: string) {
    const env = {
        PUBLIC_API_TOKEN: 'read-token',
        MCP_WRITE_TOKEN: 'write-token',
    } as Env;
    const request = new Request('https://chronolog.test/api/mcp', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'tools/list',
        }),
    });
    return { request, env } as Parameters<typeof onRequestPost>[0];
}

describe('MCP tool surface', () => {
    it('exposes only domain read tools to the public token', async () => {
        const response = await onRequestPost(context('read-token'));
        const body = await response.json<{ result: { tools: Array<{ name: string }> } }>();
        expect(body.result.tools.map(tool => tool.name)).toEqual([
            'search_notes',
            'search_sessions',
            'get_day',
            'get_stats',
            'list_categories_and_tags',
        ]);
    });

    it('adds separate note/session write tools for the write token', async () => {
        const response = await onRequestPost(context('write-token'));
        const body = await response.json<{ result: { tools: Array<{ name: string }> } }>();
        expect(body.result.tools.map(tool => tool.name)).toEqual(expect.arrayContaining([
            'add_note',
            'start_session',
            'end_session',
        ]));
        expect(body.result.tools.map(tool => tool.name)).not.toContain('add_entry');
    });
});
