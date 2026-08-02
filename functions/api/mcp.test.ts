import { describe, expect, it } from 'vitest';
import { buildKeywordSearch, buildNote, buildSession, buildZaddyComment, filterByTags, onRequestPost } from './mcp.ts';
import { isZaddyComment } from '../../src/utils/zaddyComment.ts';
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

    it('anchors a comment to exactly one entry, as a zaddy-authored note', () => {
        const comment = buildZaddyComment('note-1', {
            id: 'comment-1',
            content: '  You were closer than you thought here.  ',
        }, 456);

        expect(comment).toEqual({
            id: 'comment-1',
            content: 'You were closer than you thought here.',
            timestamp: 456,
            contentType: 'zaddy-comment',
            linkedItems: ['note-1'],
            origin: 'zaddy',
        });
        expect(isZaddyComment(comment)).toBe(true);
    });

    it('rejects an empty comment', () => {
        expect(() => buildZaddyComment('note-1', { content: '   ' })).toThrow('content');
    });
});

function context(token: string, { viaQuery = false } = {}) {
    const env = {
        PUBLIC_API_TOKEN: 'read-token',
        MCP_WRITE_TOKEN: 'write-token',
    } as Env;
    const url = viaQuery
        ? `https://chronolog.test/api/mcp?token=${token}`
        : 'https://chronolog.test/api/mcp';
    const request = new Request(url, {
        method: 'POST',
        headers: {
            ...(viaQuery ? {} : { Authorization: `Bearer ${token}` }),
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
            'observe',
        ]));
        expect(body.result.tools.map(tool => tool.name)).not.toContain('add_entry');
    });

    it('degrades a write token in the query string to read-only', async () => {
        const response = await onRequestPost(context('write-token', { viaQuery: true }));
        const body = await response.json<{ result: { tools: Array<{ name: string }> } }>();
        const names = body.result.tools.map(tool => tool.name);
        expect(names).toContain('search_notes');
        expect(names).not.toContain('add_note');
        expect(names).not.toContain('observe');
    });

    it('rejects an unknown token', async () => {
        const response = await onRequestPost(context('wrong-token'));
        expect(response.status).toBe(401);
    });
});

describe('keyword search planning', () => {
    it('routes long keywords to FTS and short ones to LIKE', () => {
        expect(buildKeywordSearch(['workout', '工作日志', 'ab', '手'])).toEqual({
            match: '"workout" OR "工作日志"',
            likes: ['ab', '手'],
        });
    });

    it('escapes double quotes so FTS operators stay literal', () => {
        expect(buildKeywordSearch(['say "hi" AND bye']).match).toBe('"say ""hi"" AND bye"');
    });

    it('returns no match expression when all keywords are short', () => {
        expect(buildKeywordSearch(['ab', '手'])).toEqual({ match: null, likes: ['ab', '手'] });
    });
});

describe('filterByTags', () => {
    const items = [
        { id: 'a', tags: ['log', 'work'] },
        { id: 'b', tags: ['backlog'] },
        { id: 'c' },
    ];

    it('matches tags exactly, not as substrings', () => {
        expect(filterByTags(items, ['log']).map(item => item.id)).toEqual(['a']);
    });

    it('requires every tag', () => {
        expect(filterByTags(items, ['log', 'work']).map(item => item.id)).toEqual(['a']);
        expect(filterByTags(items, ['log', 'missing'])).toEqual([]);
    });

    it('passes everything through without tag filters', () => {
        expect(filterByTags(items, undefined)).toHaveLength(3);
    });
});
