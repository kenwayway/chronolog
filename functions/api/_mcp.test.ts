import { describe, expect, it } from 'vitest';
import {
    buildKeywordSearch,
    buildMediaItem,
    buildNote,
    buildSession,
    buildZaddyComment,
    filterByTags,
    handleMcpRequest,
    summarizeContentType,
} from './_mcp.ts';
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

    it('builds a media library item with type-specific metadata', () => {
        expect(buildMediaItem({
            title: '  Perfect Blue  ',
            mediaType: 'Movie',
            createdAt: '2026-08-20T01:30:00-04:00',
            rating: 9.5,
            status: 'Completed',
            dateFinished: '2026-08-19',
            coverUrl: '  https://example.com/perfect-blue.jpg  ',
            notes: '  Still thinking about the edits.  ',
            metadata: {
                director: '  Satoshi Kon  ',
                year: 1997,
                genre: 'Psychological thriller',
            },
        }, 0, 'media-1')).toEqual({
            id: 'media-1',
            title: 'Perfect Blue',
            mediaType: 'Movie',
            createdAt: Date.parse('2026-08-20T01:30:00-04:00'),
            rating: 9.5,
            status: 'Completed',
            dateFinished: '2026-08-19',
            coverUrl: 'https://example.com/perfect-blue.jpg',
            notes: 'Still thinking about the edits.',
            metadata: {
                director: 'Satoshi Kon',
                year: 1997,
                genre: 'Psychological thriller',
            },
        });
    });

    it('rejects invalid media library fields', () => {
        expect(() => buildMediaItem({ title: 'Unknown', mediaType: 'Album' }))
            .toThrow('mediaType');
        expect(() => buildMediaItem({ title: 'Book', mediaType: 'Book', rating: 11 }))
            .toThrow('rating');
        expect(() => buildMediaItem({
            title: 'Book',
            mediaType: 'Book',
            metadata: { director: 'Wrong shape' },
        })).toThrow('not valid for Book');
        expect(() => buildMediaItem({
            title: 'Movie',
            mediaType: 'Movie',
            dateFinished: '2026-02-31',
        })).toThrow('valid calendar date');
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

async function listTools(canWrite: boolean): Promise<string[]> {
    const request = new Request('https://chronolog-mcp.test/mcp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
    });
    const response = await handleMcpRequest(request, {} as Env, canWrite);
    const body = await response.json<{ result: { tools: Array<{ name: string }> } }>();
    return body.result.tools.map(tool => tool.name);
}

describe('MCP tool surface', () => {
    it('exposes only domain read tools without the write scope', async () => {
        expect(await listTools(false)).toEqual([
            'search_notes',
            'search_sessions',
            'get_day',
            'get_stats',
            'list_categories_and_tags',
        ]);
    });

    it('adds domain write tools with the write scope', async () => {
        const names = await listTools(true);
        expect(names).toEqual(expect.arrayContaining([
            'add_media_item',
            'add_note',
            'start_session',
            'end_session',
            'observe',
        ]));
        expect(names).not.toContain('add_entry');
    });
});

function mediaWriteDb() {
    const batched: Array<{ sql: string; values: unknown[] }> = [];
    const db = {
        prepare(sql: string) {
            const statement = {
                sql,
                values: [] as unknown[],
                bind(...values: unknown[]) {
                    statement.values = values;
                    return statement;
                },
                async first() {
                    if (sql.includes('SELECT id FROM media_items')) return null;
                    if (sql.includes('MAX(revision)')) return { revision: 9 };
                    return null;
                },
                async all() { return { results: [] }; },
            };
            return statement;
        },
        async batch(statements: Array<{ sql: string; values: unknown[] }>) {
            batched.push(...statements);
            return statements.map(() => ({ success: true }));
        },
    } as unknown as D1Database;
    return { db, batched };
}

describe('add_media_item MCP tool', () => {
    it('writes a MediaItem mutation without creating a timeline entity', async () => {
        const { db, batched } = mediaWriteDb();
        const request = new Request('https://chronolog-mcp.test/mcp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jsonrpc: '2.0',
                id: 1,
                method: 'tools/call',
                params: {
                    name: 'add_media_item',
                    arguments: {
                        id: 'media-1',
                        title: 'Perfect Blue',
                        mediaType: 'Movie',
                        status: 'Completed',
                        metadata: { director: 'Satoshi Kon', year: 1997 },
                    },
                },
            }),
        });
        const response = await handleMcpRequest(request, { CHRONOLOG_DB: db } as Env, true);
        const body = await response.json<{
            result: { content: Array<{ text: string }>; isError?: boolean };
        }>();
        const data = JSON.parse(body.result.content[0].text) as {
            mediaItem: { id: string; title: string; mediaType: string };
            revision: number;
        };

        expect(body.result.isError).not.toBe(true);
        expect(data).toMatchObject({
            mediaItem: { id: 'media-1', title: 'Perfect Blue', mediaType: 'Movie' },
            revision: 9,
        });
        expect(batched.some(statement => statement.sql.includes('INSERT INTO media_items'))).toBe(true);
        expect(batched.some(statement => statement.sql.includes('INSERT INTO notes'))).toBe(false);
        expect(batched.some(statement => statement.sql.includes('INSERT INTO sessions'))).toBe(false);
    });

    it('requires the write scope before touching the database', async () => {
        const request = new Request('https://chronolog-mcp.test/mcp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jsonrpc: '2.0',
                id: 1,
                method: 'tools/call',
                params: {
                    name: 'add_media_item',
                    arguments: { title: 'Perfect Blue', mediaType: 'Movie' },
                },
            }),
        });
        const response = await handleMcpRequest(request, {} as Env, false);
        const body = await response.json<{
            result: { content: Array<{ text: string }>; isError?: boolean };
        }>();

        expect(body.result.isError).toBe(true);
        expect(body.result.content[0].text).toContain('chronolog:write');
    });
});

describe('summarizeContentType', () => {
    const mood = {
        id: 'mood',
        name: 'Mood',
        fields: '[{"id":"feeling","type":"dropdown","options":["Happy","Sad"],"default":"Happy"},{"id":"energy","type":"number"}]',
    };

    it('reduces a content type to its field names', () => {
        expect(summarizeContentType(mood, false)).toEqual({
            id: 'mood',
            name: 'Mood',
            fields: ['feeling', 'energy'],
        });
    });

    it('drops the field key entirely when a type has none', () => {
        expect(summarizeContentType({ id: 'note', name: 'Note', fields: '[]' }, false))
            .toEqual({ id: 'note', name: 'Note' });
    });

    it('returns the raw definition when the caller is about to write a typed entry', () => {
        expect(summarizeContentType(mood, true)).toBe(mood);
    });

    it('survives a malformed historical definition', () => {
        expect(summarizeContentType({ id: 'legacy', name: 'Legacy', fields: 'not json' }, false))
            .toEqual({ id: 'legacy', name: 'Legacy' });
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
