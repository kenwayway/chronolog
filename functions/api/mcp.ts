import { noteRowToObject, sessionRowToObject } from './_db.ts';
import { applyMutationsWithNotionSync, type NotionSyncStatus } from './_notionSync.ts';
import type { RevisionMutation } from './_revisionSync.ts';
import type { CFContext, Env, Note, NoteRow, Session, SessionRow } from './types.ts';
import { CATEGORIES, CATEGORY_IDS } from '../../src/utils/categories.ts';
import { normalizeNotionPageId } from '../../src/utils/notionPageId.ts';

const SERVER_INFO = { name: 'chronolog', version: '2.0.0' };
const SUPPORTED_PROTOCOL_VERSIONS = ['2025-06-18', '2025-03-26', '2024-11-05'];
const DEFAULT_TIMEZONE = 'America/Toronto';
const DAY_MS = 86_400_000;

interface JsonRpcRequest {
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

const dateProperties = {
    start: { type: 'string', description: 'Start date YYYY-MM-DD, inclusive' },
    end: { type: 'string', description: 'End date YYYY-MM-DD, inclusive' },
    timezone: { type: 'string', description: 'IANA timezone or fixed UTC offset; defaults to America/Toronto' },
};

const READ_TOOLS = [
    {
        name: 'search_notes',
        description: 'Literal substring search across note content, tags, and structured fields. Pass several synonym variants; keywords are OR-matched.',
        inputSchema: {
            type: 'object',
            properties: {
                keywords: { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: 8 },
                ...dateProperties,
                category: { type: 'string', enum: CATEGORY_IDS },
                tags: { type: 'array', items: { type: 'string' } },
                limit: { type: 'number', description: 'Default 50, maximum 200' },
            },
            required: ['keywords'],
        },
    },
    {
        name: 'search_sessions',
        description: 'Literal substring search across session start/end content, tags, and structured fields.',
        inputSchema: {
            type: 'object',
            properties: {
                keywords: { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: 8 },
                ...dateProperties,
                category: { type: 'string', enum: CATEGORY_IDS },
                limit: { type: 'number', description: 'Default 50, maximum 200' },
            },
            required: ['keywords'],
        },
    },
    {
        name: 'get_day',
        description: 'Get first-class notes and sessions for one calendar day plus tracked-time totals by category.',
        inputSchema: {
            type: 'object',
            properties: {
                date: { type: 'string', description: 'Date YYYY-MM-DD' },
                timezone: dateProperties.timezone,
            },
            required: ['date'],
        },
    },
    {
        name: 'get_stats',
        description: 'Aggregate completed session duration and note counts over a date range.',
        inputSchema: {
            type: 'object',
            properties: dateProperties,
            required: ['start', 'end'],
        },
    },
    {
        name: 'list_categories_and_tags',
        description: 'List fixed categories, content types, and most-used note/session tags.',
        inputSchema: { type: 'object', properties: {} },
    },
] as const;

const sharedWriteProperties = {
    id: { type: 'string', maxLength: 100 },
    content: { type: 'string', maxLength: 100000 },
    timestamp: { type: 'string', description: 'ISO 8601 timestamp with explicit offset or Z; defaults to now' },
    category: { type: 'string', enum: CATEGORY_IDS },
    tags: { type: 'array', items: { type: 'string' }, maxItems: 30 },
    contentType: { type: 'string', maxLength: 100 },
    fieldValues: { type: 'object', additionalProperties: true },
    linkedItems: { type: 'array', items: { type: 'string' }, maxItems: 50 },
    timezone: dateProperties.timezone,
};

const WRITE_TOOLS = [
    {
        name: 'add_note',
        description: 'Create a note. Use only when the user explicitly asks to save or log it.',
        inputSchema: {
            type: 'object',
            properties: {
                ...sharedWriteProperties,
                sessionId: { type: 'string', description: 'Optional owning session ID' },
            },
            required: ['content'],
            additionalProperties: false,
        },
    },
    {
        name: 'start_session',
        description: 'Start a first-class timed session. Fails if another session is open at that time.',
        inputSchema: {
            type: 'object',
            properties: sharedWriteProperties,
            required: ['content'],
            additionalProperties: false,
        },
    },
    {
        name: 'end_session',
        description: 'End an open first-class session. Uses the latest open session when sessionId is omitted.',
        inputSchema: {
            type: 'object',
            properties: {
                sessionId: { type: 'string' },
                endAt: sharedWriteProperties.timestamp,
                content: { type: 'string', maxLength: 100000 },
                tags: sharedWriteProperties.tags,
                timezone: dateProperties.timezone,
            },
            additionalProperties: false,
        },
    },
] as const;

function rpcResult(id: number | string | null, result: unknown): JsonRpcResponse {
    return { jsonrpc: '2.0', id, result };
}

function rpcError(id: number | string | null, code: number, message: string): JsonRpcResponse {
    return { jsonrpc: '2.0', id, error: { code, message } };
}

function resolveTimezone(value: unknown): string {
    const timezone = typeof value === 'string' && value ? value : DEFAULT_TIMEZONE;
    if (/^[+-]\d{2}:\d{2}$/.test(timezone)) return timezone;
    try {
        new Intl.DateTimeFormat('en-US', { timeZone: timezone });
        return timezone;
    } catch {
        throw new Error(`Invalid timezone "${timezone}"`);
    }
}

function offsetMinutesAt(timestamp: number, timezone: string): number {
    const fixed = /^([+-])(\d{2}):(\d{2})$/.exec(timezone);
    if (fixed) {
        const minutes = Number(fixed[2]) * 60 + Number(fixed[3]);
        return fixed[1] === '-' ? -minutes : minutes;
    }
    const value = new Intl.DateTimeFormat('en-US', { timeZone: timezone, timeZoneName: 'longOffset' })
        .formatToParts(new Date(timestamp))
        .find(part => part.type === 'timeZoneName')?.value || '';
    const match = /GMT([+-])(\d{1,2}):?(\d{2})?/.exec(value);
    if (!match) return 0;
    const minutes = Number(match[2]) * 60 + Number(match[3] || 0);
    return match[1] === '-' ? -minutes : minutes;
}

function dayStartMs(value: unknown, timezone: string): number {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        throw new Error(`Invalid date "${String(value)}", expected YYYY-MM-DD`);
    }
    const guess = Date.parse(`${value}T00:00:00Z`);
    const first = guess - offsetMinutesAt(guess, timezone) * 60_000;
    return guess - offsetMinutesAt(first, timezone) * 60_000;
}

function parseTimestamp(value: unknown, fallback = Date.now()): number {
    if (value === undefined) return fallback;
    if (typeof value !== 'string' || !/(Z|[+-]\d{2}:\d{2})$/.test(value)) {
        throw new Error('timestamp must be ISO 8601 with an explicit offset or Z');
    }
    const parsed = Date.parse(value);
    if (!Number.isFinite(parsed)) throw new Error('timestamp is invalid');
    return parsed;
}

function formatLocal(timestamp: number, timezone: string): string {
    return new Date(timestamp + offsetMinutesAt(timestamp, timezone) * 60_000)
        .toISOString().slice(0, 16).replace('T', ' ');
}

function cleanTags(value: unknown): string[] | undefined {
    if (value === undefined) return undefined;
    if (!Array.isArray(value) || value.some(tag => typeof tag !== 'string')) {
        throw new Error('tags must be an array of strings');
    }
    const tags = [...new Set(value.map(tag => tag.replace(/^#+/, '').trim()).filter(Boolean))];
    return tags.length ? tags : undefined;
}

function cleanLinks(value: unknown): string[] | undefined {
    if (value === undefined) return undefined;
    if (!Array.isArray(value) || value.some(id => typeof id !== 'string' || !id)) {
        throw new Error('linkedItems must be an array of IDs');
    }
    return [...new Set(value as string[])];
}

function commonFields(args: Record<string, unknown>) {
    const category = args.category;
    if (category !== undefined && (typeof category !== 'string' || !CATEGORY_IDS.includes(category))) {
        throw new Error('category is invalid');
    }
    const contentType = typeof args.contentType === 'string' ? args.contentType : undefined;
    const fieldValues = args.fieldValues;
    if (fieldValues !== undefined && (!fieldValues || typeof fieldValues !== 'object' || Array.isArray(fieldValues))) {
        throw new Error('fieldValues must be an object');
    }
    if (contentType === 'notion-task') {
        const notionPageId = normalizeNotionPageId((fieldValues as Record<string, unknown> | undefined)?.notionPageId);
        if (!notionPageId) throw new Error('notion-task requires a valid notionPageId');
        return {
            category,
            contentType,
            fieldValues: { ...(fieldValues as Record<string, unknown>), notionPageId },
            tags: cleanTags(args.tags),
            linkedItems: cleanLinks(args.linkedItems),
        };
    }
    return {
        category,
        contentType,
        fieldValues: fieldValues as Record<string, unknown> | undefined,
        tags: cleanTags(args.tags),
        linkedItems: cleanLinks(args.linkedItems),
    };
}

function newId(value: unknown): string {
    if (value === undefined) return crypto.randomUUID();
    if (typeof value !== 'string' || !value || value.length > 100) throw new Error('id is invalid');
    return value;
}

export function buildNote(args: Record<string, unknown>, now = Date.now(), generatedId?: string): Note {
    if (typeof args.content !== 'string' || !args.content.trim()) {
        throw new Error('content must be a non-empty string');
    }
    if (args.contentType === 'notion-task') throw new Error('notion-task can only be attached to a session');
    return {
        id: generatedId ?? newId(args.id),
        content: args.content.trim(),
        timestamp: parseTimestamp(args.timestamp, now),
        ...(typeof args.sessionId === 'string' ? { sessionId: args.sessionId } : {}),
        ...commonFields(args),
    };
}

export function buildSession(args: Record<string, unknown>, now = Date.now(), generatedId?: string): Session {
    if (typeof args.content !== 'string' || !args.content.trim()) {
        throw new Error('content must be a non-empty string');
    }
    return {
        id: generatedId ?? newId(args.id),
        content: args.content.trim(),
        startAt: parseTimestamp(args.timestamp, now),
        endAt: null,
        ...commonFields(args),
    };
}

function compactNote(note: Note, timezone: string) {
    return { ...note, localTime: formatLocal(note.timestamp, timezone) };
}

function compactSession(session: Session, timezone: string) {
    return {
        ...session,
        localStart: formatLocal(session.startAt, timezone),
        ...(session.endAt !== null ? {
            localEnd: formatLocal(session.endAt, timezone),
            durationMs: session.endAt - session.startAt,
        } : {}),
    };
}

async function searchNotes(args: Record<string, unknown>, db: D1Database) {
    const keywords = args.keywords;
    if (!Array.isArray(keywords) || keywords.length === 0 || keywords.some(item => typeof item !== 'string')) {
        throw new Error('keywords must be a non-empty string array');
    }
    const timezone = resolveTimezone(args.timezone);
    const conditions = [`(${keywords.map(() => "(content LIKE ? OR tags LIKE ? OR field_values LIKE ?)").join(' OR ')})`];
    const bindings: unknown[] = keywords.flatMap(keyword => {
        const pattern = `%${keyword}%`;
        return [pattern, pattern, pattern];
    });
    addRangeFilters(args, timezone, conditions, bindings, 'timestamp');
    if (typeof args.category === 'string') {
        conditions.push('category = ?');
        bindings.push(args.category);
    }
    if (Array.isArray(args.tags)) {
        args.tags.forEach(tag => {
            conditions.push('tags LIKE ?');
            bindings.push(`%"${String(tag).replace(/^#/, '')}"%`);
        });
    }
    const limit = Math.min(Math.max(Number(args.limit || 50), 1), 200);
    const result = await db.prepare(
        `SELECT * FROM notes WHERE ${conditions.join(' AND ')} ORDER BY timestamp DESC LIMIT ?`
    ).bind(...bindings, limit).all<NoteRow>();
    return { notes: result.results.map(row => compactNote(noteRowToObject(row), timezone)) };
}

async function searchSessions(args: Record<string, unknown>, db: D1Database) {
    const keywords = args.keywords;
    if (!Array.isArray(keywords) || keywords.length === 0 || keywords.some(item => typeof item !== 'string')) {
        throw new Error('keywords must be a non-empty string array');
    }
    const timezone = resolveTimezone(args.timezone);
    const conditions = [`(${keywords.map(() => "(content LIKE ? OR end_content LIKE ? OR tags LIKE ? OR end_tags LIKE ? OR field_values LIKE ?)").join(' OR ')})`];
    const bindings: unknown[] = keywords.flatMap(keyword => {
        const pattern = `%${keyword}%`;
        return [pattern, pattern, pattern, pattern, pattern];
    });
    addRangeFilters(args, timezone, conditions, bindings, 'start_at');
    if (typeof args.category === 'string') {
        conditions.push('category = ?');
        bindings.push(args.category);
    }
    const limit = Math.min(Math.max(Number(args.limit || 50), 1), 200);
    const result = await db.prepare(
        `SELECT * FROM sessions WHERE ${conditions.join(' AND ')} ORDER BY start_at DESC LIMIT ?`
    ).bind(...bindings, limit).all<SessionRow>();
    return { sessions: result.results.map(row => compactSession(sessionRowToObject(row), timezone)) };
}

function addRangeFilters(
    args: Record<string, unknown>,
    timezone: string,
    conditions: string[],
    bindings: unknown[],
    column: string,
) {
    if (args.start) {
        conditions.push(`${column} >= ?`);
        bindings.push(dayStartMs(args.start, timezone));
    }
    if (args.end) {
        conditions.push(`${column} < ?`);
        bindings.push(dayStartMs(args.end, timezone) + DAY_MS);
    }
}

async function getDay(args: Record<string, unknown>, db: D1Database) {
    const timezone = resolveTimezone(args.timezone);
    const start = dayStartMs(args.date, timezone);
    const end = start + DAY_MS;
    const [notes, sessions] = await Promise.all([
        db.prepare('SELECT * FROM notes WHERE timestamp >= ? AND timestamp < ? ORDER BY timestamp ASC')
            .bind(start, end).all<NoteRow>(),
        db.prepare('SELECT * FROM sessions WHERE start_at >= ? AND start_at < ? ORDER BY start_at ASC')
            .bind(start, end).all<SessionRow>(),
    ]);
    const sessionObjects = sessions.results.map(sessionRowToObject);
    const trackedByCategory: Record<string, number> = {};
    sessionObjects.forEach(session => {
        if (session.endAt === null || session.endAt <= session.startAt) return;
        const category = session.category || 'uncategorized';
        trackedByCategory[category] = (trackedByCategory[category] || 0) + session.endAt - session.startAt;
    });
    return {
        date: args.date,
        notes: notes.results.map(row => compactNote(noteRowToObject(row), timezone)),
        sessions: sessionObjects.map(session => compactSession(session, timezone)),
        trackedByCategory,
    };
}

async function getStats(args: Record<string, unknown>, db: D1Database) {
    const timezone = resolveTimezone(args.timezone);
    const start = dayStartMs(args.start, timezone);
    const end = dayStartMs(args.end, timezone) + DAY_MS;
    const [sessions, notes] = await Promise.all([
        db.prepare(`
            SELECT category, COUNT(*) AS session_count,
                   SUM(CASE WHEN end_at IS NOT NULL AND end_at > start_at THEN end_at - start_at ELSE 0 END) AS tracked_ms
            FROM sessions WHERE start_at >= ? AND start_at < ? GROUP BY category
        `).bind(start, end).all<{ category: string | null; session_count: number; tracked_ms: number }>(),
        db.prepare(`
            SELECT category, COUNT(*) AS note_count
            FROM notes WHERE timestamp >= ? AND timestamp < ? GROUP BY category
        `).bind(start, end).all<{ category: string | null; note_count: number }>(),
    ]);
    const categories = new Map<string, { trackedMs: number; sessions: number; notes: number }>();
    const get = (category: string | null) => {
        const id = category || 'uncategorized';
        if (!categories.has(id)) categories.set(id, { trackedMs: 0, sessions: 0, notes: 0 });
        return categories.get(id)!;
    };
    sessions.results.forEach(row => Object.assign(get(row.category), {
        trackedMs: Number(row.tracked_ms || 0),
        sessions: Number(row.session_count || 0),
    }));
    notes.results.forEach(row => { get(row.category).notes = Number(row.note_count || 0); });
    return { start: args.start, end: args.end, categories: Object.fromEntries(categories) };
}

async function listCategoriesAndTags(db: D1Database) {
    const [contentTypes, noteTags, sessionTags] = await Promise.all([
        db.prepare('SELECT id, name, icon, fields FROM content_types ORDER BY sort_order').all(),
        db.prepare("SELECT tags FROM notes WHERE tags IS NOT NULL AND tags != '[]'").all<{ tags: string }>(),
        db.prepare("SELECT tags, end_tags FROM sessions WHERE tags IS NOT NULL OR end_tags IS NOT NULL")
            .all<{ tags: string | null; end_tags: string | null }>(),
    ]);
    const counts = new Map<string, number>();
    const count = (value: string | null) => {
        if (!value) return;
        try {
            (JSON.parse(value) as string[]).forEach(tag => counts.set(tag, (counts.get(tag) || 0) + 1));
        } catch { /* ignore malformed historical tags */ }
    };
    noteTags.results.forEach(row => count(row.tags));
    sessionTags.results.forEach(row => { count(row.tags); count(row.end_tags); });
    return {
        categories: CATEGORIES,
        contentTypes: contentTypes.results,
        tags: [...counts].sort((a, b) => b[1] - a[1]).slice(0, 100)
            .map(([tag, total]) => ({ tag, count: total })),
    };
}

async function existingEntity(db: D1Database, id: string): Promise<{ type: 'note' | 'session'; value: Note | Session } | null> {
    const note = await db.prepare('SELECT * FROM notes WHERE id = ?').bind(id).first<NoteRow>();
    if (note) return { type: 'note', value: noteRowToObject(note) };
    const session = await db.prepare('SELECT * FROM sessions WHERE id = ?').bind(id).first<SessionRow>();
    return session ? { type: 'session', value: sessionRowToObject(session) } : null;
}

async function linkMutations(
    db: D1Database,
    sourceType: 'note' | 'session',
    source: Note | Session,
): Promise<RevisionMutation[]> {
    const mutations: RevisionMutation[] = [{
        mutationId: crypto.randomUUID(),
        entityType: sourceType,
        entityId: source.id,
        operation: 'upsert',
        value: source,
    }];
    for (const linkedId of source.linkedItems || []) {
        const linked = await existingEntity(db, linkedId);
        if (!linked) throw new Error(`Linked item "${linkedId}" does not exist`);
        const linkedItems = [...new Set([...(linked.value.linkedItems || []), source.id])];
        mutations.push({
            mutationId: crypto.randomUUID(),
            entityType: linked.type,
            entityId: linked.value.id,
            operation: 'upsert',
            value: { ...linked.value, linkedItems },
        });
    }
    return mutations;
}

async function ensureUniqueId(db: D1Database, id: string) {
    if (await existingEntity(db, id)) throw new Error(`ID "${id}" already exists`);
}

async function addNote(args: Record<string, unknown>, env: Env) {
    const note = buildNote(args);
    await ensureUniqueId(env.CHRONOLOG_DB, note.id);
    if (note.sessionId) {
        const owner = await existingEntity(env.CHRONOLOG_DB, note.sessionId);
        if (!owner || owner.type !== 'session') throw new Error(`Session "${note.sessionId}" does not exist`);
    }
    const result = await applyMutationsWithNotionSync(
        env,
        await linkMutations(env.CHRONOLOG_DB, 'note', note),
    );
    return { note, revision: result.revision };
}

async function startSession(args: Record<string, unknown>, env: Env) {
    const session = buildSession(args);
    await ensureUniqueId(env.CHRONOLOG_DB, session.id);
    const open = await env.CHRONOLOG_DB.prepare(
        'SELECT id FROM sessions WHERE end_at IS NULL AND start_at <= ? ORDER BY start_at DESC LIMIT 1'
    ).bind(session.startAt).first<{ id: string }>();
    if (open) throw new Error(`Session "${open.id}" is still open`);
    const result = await applyMutationsWithNotionSync(
        env,
        await linkMutations(env.CHRONOLOG_DB, 'session', session),
    );
    return { session, revision: result.revision };
}

async function endSession(args: Record<string, unknown>, env: Env) {
    let row: SessionRow | null;
    if (typeof args.sessionId === 'string') {
        row = await env.CHRONOLOG_DB.prepare('SELECT * FROM sessions WHERE id = ?')
            .bind(args.sessionId).first<SessionRow>();
    } else {
        row = await env.CHRONOLOG_DB.prepare(
            'SELECT * FROM sessions WHERE end_at IS NULL ORDER BY start_at DESC LIMIT 1'
        ).first<SessionRow>();
    }
    if (!row) throw new Error('No open session found');
    if (row.end_at !== null) throw new Error(`Session "${row.id}" is already closed`);
    const endAt = parseTimestamp(args.endAt);
    if (endAt < row.start_at) throw new Error('endAt cannot be before session start');
    const updated: Session = {
        ...sessionRowToObject(row),
        endAt,
        ...(typeof args.content === 'string' && args.content.trim() ? { endContent: args.content.trim() } : {}),
        ...(cleanTags(args.tags) ? { endTags: cleanTags(args.tags) } : {}),
    };
    const result = await applyMutationsWithNotionSync(env, [{
        mutationId: crypto.randomUUID(),
        entityType: 'session',
        entityId: updated.id,
        operation: 'upsert',
        value: updated,
    }]);
    return {
        session: compactSession(updated, resolveTimezone(args.timezone)),
        revision: result.revision,
        notionSync: result.notionSync as NotionSyncStatus | undefined,
    };
}

async function callTool(params: Record<string, unknown> | undefined, env: Env, canWrite: boolean) {
    const name = params?.name;
    const args = (params?.arguments ?? {}) as Record<string, unknown>;
    try {
        let data: unknown;
        if (name === 'search_notes') data = await searchNotes(args, env.CHRONOLOG_DB);
        else if (name === 'search_sessions') data = await searchSessions(args, env.CHRONOLOG_DB);
        else if (name === 'get_day') data = await getDay(args, env.CHRONOLOG_DB);
        else if (name === 'get_stats') data = await getStats(args, env.CHRONOLOG_DB);
        else if (name === 'list_categories_and_tags') data = await listCategoriesAndTags(env.CHRONOLOG_DB);
        else if (name === 'add_note' && canWrite) data = await addNote(args, env);
        else if (name === 'start_session' && canWrite) data = await startSession(args, env);
        else if (name === 'end_session' && canWrite) data = await endSession(args, env);
        else if (WRITE_TOOLS.some(tool => tool.name === name)) throw new Error(`${String(name)} requires MCP_WRITE_TOKEN`);
        else throw new Error(`Unknown tool: ${String(name)}`);
        return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    } catch (error) {
        return {
            content: [{ type: 'text', text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
            isError: true,
        };
    }
}

async function handleMessage(message: unknown, env: Env, canWrite: boolean): Promise<JsonRpcResponse | null> {
    if (!message || typeof message !== 'object') return rpcError(null, -32600, 'Invalid Request');
    const { id, method, params } = message as JsonRpcRequest;
    if (typeof method !== 'string') return rpcError(id ?? null, -32600, 'Invalid Request');
    if (method.startsWith('notifications/')) return null;
    if (method === 'initialize') {
        const requested = String(params?.protocolVersion || '');
        return rpcResult(id ?? null, {
            protocolVersion: SUPPORTED_PROTOCOL_VERSIONS.includes(requested)
                ? requested
                : SUPPORTED_PROTOCOL_VERSIONS[0],
            capabilities: { tools: {} },
            serverInfo: SERVER_INFO,
        });
    }
    if (method === 'ping') return rpcResult(id ?? null, {});
    if (method === 'tools/list') {
        return rpcResult(id ?? null, {
            tools: canWrite ? [...READ_TOOLS, ...WRITE_TOOLS] : READ_TOOLS,
        });
    }
    if (method === 'tools/call') return rpcResult(id ?? null, await callTool(params, env, canWrite));
    return id === undefined ? null : rpcError(id ?? null, -32601, `Method not found: ${method}`);
}

export async function onRequestPost(context: CFContext): Promise<Response> {
    const { request, env } = context;
    if (!env.PUBLIC_API_TOKEN && !env.MCP_WRITE_TOKEN && !env.DASHBOARD_MCP_TOKEN) {
        return Response.json({ error: 'MCP server not configured' }, { status: 503 });
    }
    const auth = request.headers.get('Authorization');
    const token = auth?.startsWith('Bearer ') ? auth.slice(7) : new URL(request.url).searchParams.get('token');
    const canWrite = Boolean(token) && (
        (Boolean(env.MCP_WRITE_TOKEN) && token === env.MCP_WRITE_TOKEN)
        || (Boolean(env.DASHBOARD_MCP_TOKEN) && token === env.DASHBOARD_MCP_TOKEN)
    );
    const canRead = canWrite || (Boolean(env.PUBLIC_API_TOKEN) && token === env.PUBLIC_API_TOKEN);
    if (!canRead) return Response.json({ error: 'Invalid or missing token' }, { status: 401 });

    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return Response.json(rpcError(null, -32700, 'Parse error'), { status: 400 });
    }
    if (Array.isArray(body)) {
        const responses = (await Promise.all(body.map(item => handleMessage(item, env, canWrite))))
            .filter((item): item is JsonRpcResponse => item !== null);
        return responses.length ? Response.json(responses) : new Response(null, { status: 202 });
    }
    const response = await handleMessage(body, env, canWrite);
    return response ? Response.json(response) : new Response(null, { status: 202 });
}

export async function onRequestGet(): Promise<Response> {
    return new Response('Method Not Allowed', { status: 405, headers: { Allow: 'POST' } });
}

export async function onRequestDelete(): Promise<Response> {
    return new Response('Method Not Allowed', { status: 405, headers: { Allow: 'POST' } });
}
