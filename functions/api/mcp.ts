// POST /api/mcp - Remote MCP server (Streamable HTTP, stateless) for AI access to entries
// Auth: "Authorization: Bearer <PUBLIC_API_TOKEN>" header, or ?token=<PUBLIC_API_TOKEN>
// Tools: search_entries, get_day, get_stats, list_categories_and_tags

import { entryRowToObject } from './_db.ts';
import type { CFContext, Env, EntryRow, Entry } from './types.ts';

const SERVER_INFO = { name: 'chronolog', version: '1.0.0' };
const SUPPORTED_PROTOCOL_VERSIONS = ['2025-06-18', '2025-03-26', '2024-11-05'];
const DEFAULT_TIMEZONE = '+08:00';

// Mirrors CATEGORIES in src/utils/constants.ts (fixed, not user-editable)
const CATEGORIES = [
    { id: 'hustle', label: 'Hustle', description: 'Life admin: visa, taxes, rent, bills, errands, paperwork' },
    { id: 'craft', label: 'Craft', description: 'Coding, drawing, creating, building projects' },
    { id: 'hardware', label: 'Hardware', description: 'Sleep, eating, workout, physical health, mental health' },
    { id: 'barter', label: 'Barter', description: 'Friends, social activities, relationships' },
    { id: 'wander', label: 'Wander', description: 'Travel, movies, relaxation, exploration' },
    { id: 'work', label: 'Work', description: 'Job tasks, meetings, work projects, office stuff' },
];
const CATEGORY_IDS = CATEGORIES.map(c => c.id);

// --- JSON-RPC types ---

interface JsonRpcRequest {
    jsonrpc?: string;
    id?: number | string | null;
    method?: unknown;
    params?: Record<string, unknown>;
}

type JsonRpcResponse = {
    jsonrpc: '2.0';
    id: number | string | null;
    result?: unknown;
    error?: { code: number; message: string };
};

function rpcResult(id: number | string | null, result: unknown): JsonRpcResponse {
    return { jsonrpc: '2.0', id, result };
}

function rpcError(id: number | string | null, code: number, message: string): JsonRpcResponse {
    return { jsonrpc: '2.0', id, error: { code, message } };
}

// --- Tool definitions ---

const TOOLS = [
    {
        name: 'search_entries',
        description:
            'Full-text search over journal/time-log entries (content, tags, structured fields). ' +
            'Matching is literal substring matching, NOT semantic — so ALWAYS provide 3-6 keyword variants: ' +
            'synonyms, related terms, and colloquial phrasings, in the same language the journal is written in ' +
            '(mostly Chinese, some English). Example: for "健身" pass ["健身", "锻炼", "运动", "跑步", "gym"]. ' +
            'Results are OR-matched across keywords, newest first. ' +
            'If results seem incomplete, retry with different variants or use get_day to read raw entries.',
        inputSchema: {
            type: 'object',
            properties: {
                keywords: {
                    type: 'array',
                    items: { type: 'string' },
                    minItems: 1,
                    maxItems: 8,
                    description: '3-6 keyword variants (synonyms, related terms, colloquial forms). OR-matched.',
                },
                start: { type: 'string', description: 'Start date YYYY-MM-DD, inclusive (optional)' },
                end: { type: 'string', description: 'End date YYYY-MM-DD, inclusive (optional)' },
                category: {
                    type: 'string',
                    enum: CATEGORY_IDS,
                    description: 'Filter by life-area category (optional). Use list_categories_and_tags to see meanings.',
                },
                tags: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Only return entries that have ALL of these exact tags (optional)',
                },
                limit: { type: 'number', description: 'Max results, default 50, max 200' },
                timezone: { type: 'string', description: 'UTC offset for date boundaries and display, e.g. "+08:00" (default)' },
            },
            required: ['keywords'],
        },
    },
    {
        name: 'get_day',
        description:
            'Get all entries for one calendar day (chronological order) plus a per-category tracked-time summary. ' +
            'Use this to answer "what did I do on <date>?" or to read raw entries when search_entries misses.',
        inputSchema: {
            type: 'object',
            properties: {
                date: { type: 'string', description: 'Date YYYY-MM-DD' },
                timezone: { type: 'string', description: 'UTC offset defining the day boundary, e.g. "+08:00" (default)' },
            },
            required: ['date'],
        },
    },
    {
        name: 'get_stats',
        description:
            'Aggregate time-tracking stats for a date range: tracked duration and entry counts per category, ' +
            'plus totals and daily average. Use this for "how much time did I spend on X" questions — ' +
            'it sums in the database, so prefer it over adding up raw entries yourself.',
        inputSchema: {
            type: 'object',
            properties: {
                start: { type: 'string', description: 'Start date YYYY-MM-DD, inclusive' },
                end: { type: 'string', description: 'End date YYYY-MM-DD, inclusive' },
                timezone: { type: 'string', description: 'UTC offset for date boundaries, e.g. "+08:00" (default)' },
            },
            required: ['start', 'end'],
        },
    },
    {
        name: 'list_categories_and_tags',
        description:
            'List the fixed life-area categories (with meanings), user-defined content types, and the most-used tags. ' +
            'Call this first when you need to pick a category filter or want to know what vocabulary the user tags with.',
        inputSchema: { type: 'object', properties: {} },
    },
];

// --- Shared helpers ---

function parseTimezone(tz: unknown): number {
    const value = typeof tz === 'string' && tz ? tz : DEFAULT_TIMEZONE;
    const match = /^([+-])(\d{2}):(\d{2})$/.exec(value);
    if (!match) throw new Error(`Invalid timezone "${value}", expected UTC offset like "+08:00"`);
    const minutes = parseInt(match[2], 10) * 60 + parseInt(match[3], 10);
    return match[1] === '-' ? -minutes : minutes;
}

function dayStartMs(date: unknown, offsetMinutes: number): number {
    if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        throw new Error(`Invalid date "${String(date)}", expected YYYY-MM-DD`);
    }
    const ms = Date.parse(`${date}T00:00:00Z`) - offsetMinutes * 60_000;
    if (Number.isNaN(ms)) throw new Error(`Invalid date "${date}"`);
    return ms;
}

const DAY_MS = 86_400_000;

/** Format a timestamp as "YYYY-MM-DD HH:mm" in the given UTC offset */
function formatLocal(timestamp: number, offsetMinutes: number): string {
    return new Date(timestamp + offsetMinutes * 60_000).toISOString().slice(0, 16).replace('T', ' ');
}

function formatDuration(ms: number): string {
    const minutes = Math.round(ms / 60_000);
    const hours = Math.floor(minutes / 60);
    return hours > 0 ? `${hours}h ${minutes % 60}m` : `${minutes}m`;
}

/** Compact entry representation to keep tool output token-friendly */
function toCompactEntry(row: EntryRow, offsetMinutes: number): Record<string, unknown> {
    const entry: Entry = entryRowToObject(row);
    const out: Record<string, unknown> = {
        id: entry.id,
        time: formatLocal(entry.timestamp, offsetMinutes),
        type: entry.type,
        content: entry.content,
    };
    if (entry.category) out.category = entry.category;
    if (entry.tags) out.tags = entry.tags;
    if (entry.duration != null) out.duration = formatDuration(entry.duration);
    if (entry.contentType) out.contentType = entry.contentType;
    if (entry.fieldValues) out.fieldValues = entry.fieldValues;
    return out;
}

function escapeLike(value: string): string {
    return value.replace(/[\\%_]/g, c => '\\' + c);
}

// --- Tool implementations ---

async function searchEntries(args: Record<string, unknown>, db: D1Database): Promise<unknown> {
    const rawKeywords = Array.isArray(args.keywords) ? args.keywords : [args.keywords];
    const keywords = rawKeywords.filter((k): k is string => typeof k === 'string' && k.trim() !== '').slice(0, 8);
    if (keywords.length === 0) throw new Error('keywords must be a non-empty array of strings');

    const offsetMinutes = parseTimezone(args.timezone);
    const conditions: string[] = [];
    const bindings: (string | number)[] = [];

    const keywordClauses = keywords.map(() =>
        "(content LIKE ? ESCAPE '\\' OR IFNULL(tags, '') LIKE ? ESCAPE '\\' OR IFNULL(field_values, '') LIKE ? ESCAPE '\\')"
    );
    for (const keyword of keywords) {
        const pattern = `%${escapeLike(keyword.trim())}%`;
        bindings.push(pattern, pattern, pattern);
    }
    conditions.push(`(${keywordClauses.join(' OR ')})`);

    if (args.start !== undefined) {
        conditions.push('timestamp >= ?');
        bindings.push(dayStartMs(args.start, offsetMinutes));
    }
    if (args.end !== undefined) {
        conditions.push('timestamp <= ?');
        bindings.push(dayStartMs(args.end, offsetMinutes) + DAY_MS - 1);
    }
    if (args.category !== undefined) {
        if (!CATEGORY_IDS.includes(args.category as string)) {
            throw new Error(`Unknown category "${String(args.category)}", valid: ${CATEGORY_IDS.join(', ')}`);
        }
        conditions.push('category = ?');
        bindings.push(args.category as string);
    }
    if (Array.isArray(args.tags)) {
        for (const tag of args.tags) {
            if (typeof tag !== 'string' || tag === '') continue;
            conditions.push("IFNULL(tags, '') LIKE ? ESCAPE '\\'");
            bindings.push(`%"${escapeLike(tag)}"%`);
        }
    }

    const limit = Math.min(Math.max(1, Number(args.limit) || 50), 200);
    bindings.push(limit);

    const result = await db
        .prepare(`SELECT * FROM entries WHERE ${conditions.join(' AND ')} ORDER BY timestamp DESC LIMIT ?`)
        .bind(...bindings)
        .all<EntryRow>();

    return {
        keywords,
        count: result.results.length,
        note: result.results.length === 0
            ? 'No matches. Try different keyword variants, or use get_day to read raw entries for a specific date.'
            : undefined,
        entries: result.results.map(row => toCompactEntry(row, offsetMinutes)),
    };
}

async function getDay(args: Record<string, unknown>, db: D1Database): Promise<unknown> {
    const offsetMinutes = parseTimezone(args.timezone);
    const start = dayStartMs(args.date, offsetMinutes);

    const result = await db
        .prepare('SELECT * FROM entries WHERE timestamp >= ? AND timestamp <= ? ORDER BY timestamp ASC')
        .bind(start, start + DAY_MS - 1)
        .all<EntryRow>();

    const byCategory: Record<string, number> = {};
    let totalMs = 0;
    for (const row of result.results) {
        if (row.type === 'SESSION_END' && row.duration != null) {
            const key = row.category || 'uncategorized';
            byCategory[key] = (byCategory[key] || 0) + row.duration;
            totalMs += row.duration;
        }
    }

    return {
        date: args.date,
        count: result.results.length,
        totalTracked: formatDuration(totalMs),
        trackedByCategory: Object.fromEntries(
            Object.entries(byCategory)
                .sort((a, b) => b[1] - a[1])
                .map(([category, ms]) => [category, formatDuration(ms)])
        ),
        entries: result.results.map(row => toCompactEntry(row, offsetMinutes)),
    };
}

async function getStats(args: Record<string, unknown>, db: D1Database): Promise<unknown> {
    const offsetMinutes = parseTimezone(args.timezone);
    const start = dayStartMs(args.start, offsetMinutes);
    const end = dayStartMs(args.end, offsetMinutes) + DAY_MS - 1;
    if (end < start) throw new Error('end date is before start date');

    const durations = await db
        .prepare(
            "SELECT category, COUNT(*) AS sessions, SUM(duration) AS total_ms FROM entries " +
            "WHERE type = 'SESSION_END' AND duration IS NOT NULL AND timestamp >= ? AND timestamp <= ? GROUP BY category"
        )
        .bind(start, end)
        .all<{ category: string | null; sessions: number; total_ms: number }>();

    const counts = await db
        .prepare('SELECT category, COUNT(*) AS entry_count FROM entries WHERE timestamp >= ? AND timestamp <= ? GROUP BY category')
        .bind(start, end)
        .all<{ category: string | null; entry_count: number }>();

    const categories = new Map<string, { trackedMs: number; sessions: number; entries: number }>();
    const get = (category: string | null) => {
        const key = category || 'uncategorized';
        let stats = categories.get(key);
        if (!stats) {
            stats = { trackedMs: 0, sessions: 0, entries: 0 };
            categories.set(key, stats);
        }
        return stats;
    };
    for (const row of durations.results) {
        const stats = get(row.category);
        stats.trackedMs = row.total_ms;
        stats.sessions = row.sessions;
    }
    for (const row of counts.results) {
        get(row.category).entries = row.entry_count;
    }

    const totalMs = durations.results.reduce((sum, row) => sum + row.total_ms, 0);
    const days = Math.round((end + 1 - start) / DAY_MS);

    return {
        start: args.start,
        end: args.end,
        days,
        totalTracked: formatDuration(totalMs),
        avgTrackedPerDay: formatDuration(totalMs / days),
        categories: [...categories.entries()]
            .sort((a, b) => b[1].trackedMs - a[1].trackedMs)
            .map(([category, stats]) => ({
                category,
                tracked: formatDuration(stats.trackedMs),
                sessions: stats.sessions,
                entries: stats.entries,
            })),
    };
}

async function listCategoriesAndTags(db: D1Database): Promise<unknown> {
    const contentTypes = await db
        .prepare('SELECT id, name FROM content_types ORDER BY sort_order ASC')
        .all<{ id: string; name: string }>();

    const tagRows = await db
        .prepare("SELECT tags FROM entries WHERE tags IS NOT NULL AND tags != '[]'")
        .all<{ tags: string }>();

    const tagCounts = new Map<string, number>();
    for (const row of tagRows.results) {
        try {
            const tags = JSON.parse(row.tags);
            if (!Array.isArray(tags)) continue;
            for (const tag of tags) {
                if (typeof tag === 'string') tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
            }
        } catch { /* ignore malformed tags */ }
    }

    return {
        categories: CATEGORIES,
        contentTypes: contentTypes.results,
        tags: [...tagCounts.entries()]
            .sort((a, b) => b[1] - a[1])
            .slice(0, 100)
            .map(([tag, count]) => ({ tag, count })),
    };
}

async function callTool(params: Record<string, unknown> | undefined, db: D1Database): Promise<unknown> {
    const name = params?.name;
    const args = (params?.arguments ?? {}) as Record<string, unknown>;

    try {
        let data: unknown;
        switch (name) {
            case 'search_entries':
                data = await searchEntries(args, db);
                break;
            case 'get_day':
                data = await getDay(args, db);
                break;
            case 'get_stats':
                data = await getStats(args, db);
                break;
            case 'list_categories_and_tags':
                data = await listCategoriesAndTags(db);
                break;
            default:
                throw new Error(`Unknown tool: ${String(name)}`);
        }
        return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { content: [{ type: 'text', text: `Error: ${message}` }], isError: true };
    }
}

// --- JSON-RPC dispatch ---

async function handleMessage(message: unknown, env: Env): Promise<JsonRpcResponse | null> {
    if (!message || typeof message !== 'object') {
        return rpcError(null, -32600, 'Invalid Request');
    }
    const { id, method, params } = message as JsonRpcRequest;
    if (typeof method !== 'string') {
        return rpcError(id ?? null, -32600, 'Invalid Request: missing method');
    }
    // Notifications (no id) expect no response
    if (method.startsWith('notifications/')) return null;

    let result: unknown;
    switch (method) {
        case 'initialize': {
            const requested = (params?.protocolVersion as string) || '';
            result = {
                protocolVersion: SUPPORTED_PROTOCOL_VERSIONS.includes(requested)
                    ? requested
                    : SUPPORTED_PROTOCOL_VERSIONS[0],
                capabilities: { tools: {} },
                serverInfo: SERVER_INFO,
            };
            break;
        }
        case 'ping':
            result = {};
            break;
        case 'tools/list':
            result = { tools: TOOLS };
            break;
        case 'tools/call':
            result = await callTool(params, env.CHRONOLOG_DB);
            break;
        default:
            return id === undefined ? null : rpcError(id ?? null, -32601, `Method not found: ${method}`);
    }

    return id === undefined ? null : rpcResult(id ?? null, result);
}

// --- HTTP handlers ---

export async function onRequestPost(context: CFContext): Promise<Response> {
    const { request, env } = context;

    if (!env.PUBLIC_API_TOKEN) {
        return Response.json({ error: 'MCP server not configured' }, { status: 503 });
    }

    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.startsWith('Bearer ')
        ? authHeader.slice(7)
        : new URL(request.url).searchParams.get('token');
    if (token !== env.PUBLIC_API_TOKEN) {
        return Response.json({ error: 'Invalid or missing token' }, { status: 401 });
    }

    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return Response.json(rpcError(null, -32700, 'Parse error'), { status: 400 });
    }

    try {
        if (Array.isArray(body)) {
            const responses = (await Promise.all(body.map(msg => handleMessage(msg, env))))
                .filter((r): r is JsonRpcResponse => r !== null);
            return responses.length === 0 ? new Response(null, { status: 202 }) : Response.json(responses);
        }
        const response = await handleMessage(body, env);
        return response === null ? new Response(null, { status: 202 }) : Response.json(response);
    } catch (error) {
        console.error('MCP error:', error);
        return Response.json(rpcError(null, -32603, 'Internal error'), { status: 500 });
    }
}

// This server is stateless: no SSE stream (GET) or session termination (DELETE)
export async function onRequestGet(): Promise<Response> {
    return new Response('Method Not Allowed', { status: 405, headers: { Allow: 'POST' } });
}

export async function onRequestDelete(): Promise<Response> {
    return new Response('Method Not Allowed', { status: 405, headers: { Allow: 'POST' } });
}
