// POST /api/mcp - Remote MCP server (Streamable HTTP, stateless) for AI access to entries
// Auth: PUBLIC_API_TOKEN grants read access; MCP_WRITE_TOKEN grants read + write access
// Tools: search_entries, get_day, get_stats, list_categories_and_tags, add_entry (write token only)

import { entryRowToObject } from './_db.ts';
import { MAX_MUTATIONS_PER_REQUEST, type RevisionMutation } from './_revisionSync.ts';
import { applyMutationsWithNotionSync, type NotionSyncStatus } from './_notionSync.ts';
import type { CFContext, Env, EntryRow, Entry } from './types.ts';
import { CATEGORIES, CATEGORY_IDS } from '../../src/utils/categories.ts';
import { normalizeNotionPageId } from '../../src/utils/notionPageId.ts';

const SERVER_INFO = { name: 'chronolog', version: '1.2.0' };
const SUPPORTED_PROTOCOL_VERSIONS = ['2025-06-18', '2025-03-26', '2024-11-05'];
const DEFAULT_TIMEZONE = 'America/Toronto';

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

const READ_TOOLS = [
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
                timezone: { type: 'string', description: 'Timezone for date boundaries and display: IANA name like "America/Toronto" (default) or UTC offset like "-04:00"' },
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
                timezone: { type: 'string', description: 'Timezone defining the day boundary: IANA name like "America/Toronto" (default) or UTC offset like "-04:00"' },
            },
            required: ['date'],
        },
    },
    {
        name: 'get_stats',
        description:
            'Aggregate time-tracking stats for a date range: tracked duration and entry counts per category, ' +
            'plus totals and daily average. Use this for "how much time did I spend on X" questions — ' +
            'it pairs session start/end timestamps and attributes time to the start category, so prefer it ' +
            'over adding up raw entries yourself.',
        inputSchema: {
            type: 'object',
            properties: {
                start: { type: 'string', description: 'Start date YYYY-MM-DD, inclusive' },
                end: { type: 'string', description: 'End date YYYY-MM-DD, inclusive' },
                timezone: { type: 'string', description: 'Timezone for date boundaries: IANA name like "America/Toronto" (default) or UTC offset like "-04:00"' },
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

const WRITE_TOOLS = [
    {
        name: 'add_entry',
        description:
            'Create one complete Chronolog entry. Use this only when the user explicitly asks to log, save, ' +
            'record, or add something to Chronolog; never infer write consent from ordinary conversation. ' +
            'Use list_categories_and_tags first when choosing a category or structured content type. ' +
            'type defaults to NOTE. Use SESSION_START to begin a timed session (sessionId is generated when omitted), ' +
            'or SESSION_END to end one (sessionId is inherited from the latest open session when omitted; ' +
            'durations are always computed from the START/END timestamps). ' +
            'The timestamp defaults to now. linkedEntries are maintained bidirectionally.',
        inputSchema: {
            type: 'object',
            properties: {
                id: {
                    type: 'string',
                    minLength: 1,
                    maxLength: 100,
                    description: 'Optional custom entry ID. A UUID is generated when omitted; existing IDs are rejected.',
                },
                type: {
                    type: 'string',
                    enum: ['SESSION_START', 'NOTE', 'SESSION_END'],
                    description: 'Entry type; defaults to NOTE',
                },
                content: {
                    type: 'string',
                    maxLength: 100000,
                    description: 'Entry content. Required and non-empty for NOTE; defaults to empty for session boundaries.',
                },
                timestamp: {
                    type: 'string',
                    description: 'Optional ISO 8601 time with explicit offset or Z, e.g. 2026-07-14T09:30:00-04:00. Defaults to now.',
                },
                category: {
                    type: 'string',
                    enum: CATEGORY_IDS,
                    description: 'Optional life-area category',
                },
                sessionId: {
                    type: 'string',
                    minLength: 1,
                    maxLength: 100,
                    description: 'Optional session ID; generated for SESSION_START, inherited from the open session for SESSION_END',
                },
                tags: {
                    type: 'array',
                    items: { type: 'string', minLength: 1, maxLength: 100 },
                    maxItems: 30,
                    description: 'Optional tags; leading # characters are removed',
                },
                contentType: {
                    type: 'string',
                    minLength: 1,
                    maxLength: 100,
                    description: 'Optional structured content type ID returned by list_categories_and_tags',
                },
                fieldValues: {
                    type: 'object',
                    additionalProperties: true,
                    description: 'Optional structured fields for contentType',
                },
                linkedEntries: {
                    type: 'array',
                    items: { type: 'string', minLength: 1, maxLength: 100 },
                    maxItems: 50,
                    description: 'Optional existing entry IDs to link bidirectionally',
                },
                timezone: {
                    type: 'string',
                    description: 'Timezone used only to format the returned time (default America/Toronto)',
                },
            },
            additionalProperties: false,
        },
        annotations: {
            title: 'Add Chronolog entry',
            readOnlyHint: false,
            destructiveHint: false,
            idempotentHint: false,
            openWorldHint: false,
        },
    },
];

function toolsForAccess(canWrite: boolean) {
    return canWrite ? [...READ_TOOLS, ...WRITE_TOOLS] : READ_TOOLS;
}

// --- Shared helpers ---

/** Validate a timezone: IANA name like "America/Toronto" or fixed UTC offset like "-04:00" */
function resolveTimezone(tz: unknown): string {
    const value = typeof tz === 'string' && tz ? tz : DEFAULT_TIMEZONE;
    if (/^[+-]\d{2}:\d{2}$/.test(value)) return value;
    try {
        new Intl.DateTimeFormat('en-US', { timeZone: value });
        return value;
    } catch {
        throw new Error(`Invalid timezone "${value}", expected IANA name like "America/Toronto" or UTC offset like "-04:00"`);
    }
}

/** UTC offset in minutes for the given timezone at the given instant (DST-aware for IANA names) */
function offsetMinutesAt(timestamp: number, timeZone: string): number {
    const fixed = /^([+-])(\d{2}):(\d{2})$/.exec(timeZone);
    if (fixed) {
        const minutes = parseInt(fixed[2], 10) * 60 + parseInt(fixed[3], 10);
        return fixed[1] === '-' ? -minutes : minutes;
    }
    const parts = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'longOffset' })
        .formatToParts(new Date(timestamp));
    const name = parts.find(p => p.type === 'timeZoneName')?.value || '';
    const match = /GMT([+-])(\d{1,2}):?(\d{2})?/.exec(name);
    if (!match) return 0; // plain "GMT" = UTC
    const minutes = parseInt(match[2], 10) * 60 + parseInt(match[3] || '0', 10);
    return match[1] === '-' ? -minutes : minutes;
}

function dayStartMs(date: unknown, timeZone: string): number {
    if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        throw new Error(`Invalid date "${String(date)}", expected YYYY-MM-DD`);
    }
    const utcGuess = Date.parse(`${date}T00:00:00Z`);
    if (Number.isNaN(utcGuess)) throw new Error(`Invalid date "${date}"`);
    // Two passes so a DST transition near midnight resolves to the correct offset
    const start = utcGuess - offsetMinutesAt(utcGuess, timeZone) * 60_000;
    return utcGuess - offsetMinutesAt(start, timeZone) * 60_000;
}

const DAY_MS = 86_400_000;

/** Format a timestamp as "YYYY-MM-DD HH:mm" in the given timezone */
function formatLocal(timestamp: number, timeZone: string): string {
    return new Date(timestamp + offsetMinutesAt(timestamp, timeZone) * 60_000)
        .toISOString().slice(0, 16).replace('T', ' ');
}

function formatDuration(ms: number): string {
    const minutes = Math.round(ms / 60_000);
    const hours = Math.floor(minutes / 60);
    return hours > 0 ? `${hours}h ${minutes % 60}m` : `${minutes}m`;
}

interface SessionRow {
    id: string;
    type: string;
    timestamp: number;
    category: string | null;
    session_id?: string | null;
}

interface Session {
    startId: string;
    startTimestamp: number;
    category: string | null;
    durationMs: number;
}

/**
 * Pair SESSION_START/SESSION_END and compute durations from timestamps
 * (mirrors src/utils/sessionPairing.ts). Pairing is session_id-first: an END
 * carrying a session_id only closes the open START with that same session_id,
 * so pairs survive timestamp edits and interleaved sessions from sync merges.
 * A legacy END without session_id closes the most recently opened START.
 * The stored duration field is NOT used: it goes stale when the user edits an
 * entry's time afterwards. Duration is attributed to the START entry, which is
 * the one carrying the category. Unclosed sessions are not returned.
 */
export function computeSessions(rows: SessionRow[]): Session[] {
    const boundaries = [...rows].sort((a, b) => a.timestamp - b.timestamp);
    const sessions: Session[] = [];
    const open: SessionRow[] = [];

    for (const row of boundaries) {
        if (row.type === 'SESSION_START') {
            open.push(row);
            continue;
        }
        if (row.type !== 'SESSION_END') continue;

        let index = -1;
        if (row.session_id) {
            for (let i = open.length - 1; i >= 0; i--) {
                if (open[i].session_id === row.session_id) { index = i; break; }
            }
        } else {
            index = open.length - 1;
        }
        if (index === -1) continue; // unmatched END — dropped

        const start = open[index];
        open.splice(index, 1);
        sessions.push({
            startId: start.id,
            startTimestamp: start.timestamp,
            category: start.category,
            durationMs: row.timestamp - start.timestamp,
        });
    }

    return sessions.sort((a, b) => a.startTimestamp - b.startTimestamp);
}

/**
 * Load the session boundaries needed to calculate sessions that START in a range.
 * The nearest row before/after the range is included so a session crossing a date
 * boundary can still be paired without scanning the full entries table.
 */
async function getSessionsForRange(db: D1Database, start: number, end: number): Promise<Session[]> {
    const previous = await db
        .prepare(
            "SELECT id, type, timestamp, category, session_id FROM entries " +
            "WHERE type IN ('SESSION_START', 'SESSION_END') AND timestamp < ? " +
            'ORDER BY timestamp DESC LIMIT 1'
        )
        .bind(start)
        .all<SessionRow>();

    const within = await db
        .prepare(
            "SELECT id, type, timestamp, category, session_id FROM entries " +
            "WHERE type IN ('SESSION_START', 'SESSION_END') AND timestamp >= ? AND timestamp <= ? " +
            'ORDER BY timestamp ASC'
        )
        .bind(start, end)
        .all<SessionRow>();

    const next = await db
        .prepare(
            "SELECT id, type, timestamp, category, session_id FROM entries " +
            "WHERE type IN ('SESSION_START', 'SESSION_END') AND timestamp > ? " +
            'ORDER BY timestamp ASC LIMIT 1'
        )
        .bind(end)
        .all<SessionRow>();

    const rows = [
        ...previous.results.reverse(),
        ...within.results,
        ...next.results,
    ];

    return computeSessions(rows).filter(
        session => session.startTimestamp >= start && session.startTimestamp <= end
    );
}

/**
 * Compact entry representation to keep tool output token-friendly.
 * When sessionDurations is given (get_day), computed durations are shown on
 * START entries; search results carry no duration (no pairing context there).
 */
function toCompactEntry(row: EntryRow, timeZone: string, sessionDurations?: Map<string, number>): Record<string, unknown> {
    const entry: Entry = entryRowToObject(row);
    const out: Record<string, unknown> = {
        id: entry.id,
        time: formatLocal(entry.timestamp, timeZone),
        type: entry.type,
        content: entry.content,
    };
    if (entry.category) out.category = entry.category;
    if (entry.tags) out.tags = entry.tags;
    if (sessionDurations) {
        const computed = sessionDurations.get(entry.id);
        if (computed !== undefined) out.duration = formatDuration(computed);
    }
    if (entry.sessionId) out.sessionId = entry.sessionId;
    if (entry.contentType) out.contentType = entry.contentType;
    if (entry.fieldValues) out.fieldValues = entry.fieldValues;
    if (entry.linkedEntries) out.linkedEntries = entry.linkedEntries;
    return out;
}

function escapeLike(value: string): string {
    return value.replace(/[\\%_]/g, c => '\\' + c);
}

const ISO_TIMESTAMP_WITH_ZONE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/;

/** Build and validate an Entry without touching D1 (exported for tests). */
export function buildEntry(
    args: Record<string, unknown>,
    now: number = Date.now(),
    generatedId: string = crypto.randomUUID(),
    generatedSessionId: string = crypto.randomUUID(),
): Entry {
    const type = args.type ?? 'NOTE';
    if (type !== 'NOTE' && type !== 'SESSION_START' && type !== 'SESSION_END') {
        throw new Error('type must be SESSION_START, NOTE, or SESSION_END');
    }

    let id = generatedId;
    if (args.id !== undefined) {
        if (typeof args.id !== 'string' || args.id.trim() === '' || args.id.length > 100) {
            throw new Error('id must be a non-empty string of at most 100 characters');
        }
        id = args.id.trim();
    }

    const content = args.content ?? '';
    if (typeof content !== 'string' || (type === 'NOTE' && content.trim() === '')) {
        throw new Error('content must be a non-empty string for NOTE entries');
    }
    if (content.length > 100_000) {
        throw new Error('content exceeds the 100000 character limit');
    }

    let timestamp = now;
    if (args.timestamp !== undefined) {
        if (typeof args.timestamp !== 'string' || !ISO_TIMESTAMP_WITH_ZONE.test(args.timestamp)) {
            throw new Error('timestamp must be ISO 8601 with an explicit UTC offset or Z');
        }
        timestamp = Date.parse(args.timestamp);
        if (!Number.isFinite(timestamp)) throw new Error(`Invalid timestamp "${args.timestamp}"`);
    }

    let category: string | undefined;
    if (args.category !== undefined) {
        if (typeof args.category !== 'string' || !CATEGORY_IDS.includes(args.category)) {
            throw new Error(`Unknown category "${String(args.category)}", valid: ${CATEGORY_IDS.join(', ')}`);
        }
        category = args.category;
    }

    let tags: string[] | undefined;
    if (args.tags !== undefined) {
        if (!Array.isArray(args.tags) || args.tags.some(tag => typeof tag !== 'string')) {
            throw new Error('tags must be an array of strings');
        }
        if (args.tags.length > 30) throw new Error('tags cannot contain more than 30 items');
        const normalized = args.tags
            .map(tag => (tag as string).trim().replace(/^#+/, ''))
            .filter(Boolean);
        if (normalized.some(tag => tag.length > 100)) throw new Error('each tag must be at most 100 characters');
        tags = [...new Set(normalized)];
    }

    let contentType: string | undefined;
    if (args.contentType !== undefined) {
        if (typeof args.contentType !== 'string' || args.contentType.trim() === '') {
            throw new Error('contentType must be a non-empty string');
        }
        contentType = args.contentType.trim();
        if (contentType.length > 100) throw new Error('contentType must be at most 100 characters');
        if (contentType === 'note') contentType = undefined;
    }

    let fieldValues: Record<string, unknown> | undefined;
    if (args.fieldValues !== undefined) {
        if (!args.fieldValues || typeof args.fieldValues !== 'object' || Array.isArray(args.fieldValues)) {
            throw new Error('fieldValues must be an object');
        }
        if (!contentType) throw new Error('fieldValues requires a non-note contentType');
        fieldValues = args.fieldValues as Record<string, unknown>;
    }

    if (contentType === 'notion-task') {
        if (type !== 'SESSION_START') {
            throw new Error('notion-task can only be used with SESSION_START');
        }
        const notionPageId = normalizeNotionPageId(fieldValues?.notionPageId);
        if (!notionPageId) {
            throw new Error('notion-task requires a valid fieldValues.notionPageId URL or page ID');
        }
        fieldValues = { ...fieldValues, notionPageId };
    }

    let sessionId: string | undefined;
    if (args.sessionId !== undefined) {
        if (typeof args.sessionId !== 'string' || args.sessionId.trim() === '' || args.sessionId.length > 100) {
            throw new Error('sessionId must be a non-empty string of at most 100 characters');
        }
        sessionId = args.sessionId.trim();
    } else if (type === 'SESSION_START') {
        sessionId = generatedSessionId;
    }

    let linkedEntries: string[] | undefined;
    if (args.linkedEntries !== undefined) {
        if (!Array.isArray(args.linkedEntries) || args.linkedEntries.some(link => typeof link !== 'string')) {
            throw new Error('linkedEntries must be an array of entry ID strings');
        }
        if (args.linkedEntries.length > 50) throw new Error('linkedEntries cannot contain more than 50 items');
        linkedEntries = [...new Set(args.linkedEntries.map(link => (link as string).trim()).filter(Boolean))];
        if (linkedEntries.some(link => link.length > 100)) {
            throw new Error('each linked entry ID must be at most 100 characters');
        }
        if (linkedEntries.includes(id)) throw new Error('an entry cannot link to itself');
    }

    return {
        id,
        type,
        content,
        timestamp,
        ...(sessionId ? { sessionId } : {}),
        ...(category ? { category } : {}),
        ...(tags && tags.length > 0 ? { tags } : {}),
        ...(contentType ? { contentType } : {}),
        ...(fieldValues ? { fieldValues } : {}),
        ...(linkedEntries && linkedEntries.length > 0 ? { linkedEntries } : {}),
    };
}

// --- Tool implementations ---

async function addEntry(args: Record<string, unknown>, env: Env): Promise<unknown> {
    const db = env.CHRONOLOG_DB;
    const timeZone = resolveTimezone(args.timezone);
    const entry = buildEntry(args);

    const duplicate = await db
        .prepare('SELECT id FROM entries WHERE id = ?')
        .bind(entry.id)
        .first<{ id: string }>();
    if (duplicate) throw new Error(`Entry ID "${entry.id}" already exists`);

    if (entry.contentType) {
        const contentType = await db
            .prepare('SELECT id FROM content_types WHERE id = ?')
            .bind(entry.contentType)
            .first<{ id: string }>();
        if (!contentType) {
            throw new Error(`Unknown contentType "${entry.contentType}"; use list_categories_and_tags to get valid IDs`);
        }
    }

    if (entry.type === 'SESSION_START' || entry.type === 'SESSION_END') {
        const latestBoundary = await db
            .prepare(
                "SELECT id, type, timestamp, category, session_id FROM entries " +
                "WHERE type IN ('SESSION_START', 'SESSION_END') AND timestamp <= ? " +
                'ORDER BY timestamp DESC LIMIT 1'
            )
            .bind(entry.timestamp)
            .first<SessionRow>();

        if (entry.type === 'SESSION_START' && latestBoundary?.type === 'SESSION_START') {
            throw new Error(`Session "${latestBoundary.id}" is already open at this timestamp; end it before starting another`);
        }
        if (entry.type === 'SESSION_END' && (!latestBoundary || latestBoundary.type !== 'SESSION_START')) {
            throw new Error('No open session found at this timestamp; create the SESSION_START first, then end it');
        }
        if (entry.type === 'SESSION_END' && latestBoundary) {
            // Inherit the open session's id so pairing no longer depends on timestamp order
            if (!entry.sessionId && latestBoundary.session_id) {
                entry.sessionId = latestBoundary.session_id;
            }
        }
    }

    const entriesToWrite: Entry[] = [entry];
    if (entry.linkedEntries && entry.linkedEntries.length > 0) {
        const placeholders = entry.linkedEntries.map(() => '?').join(', ');
        const linkedRows = await db
            .prepare(`SELECT * FROM entries WHERE id IN (${placeholders})`)
            .bind(...entry.linkedEntries)
            .all<EntryRow>();
        const foundIds = new Set(linkedRows.results.map(row => row.id));
        const missingIds = entry.linkedEntries.filter(id => !foundIds.has(id));
        if (missingIds.length > 0) {
            throw new Error(`Unknown linkedEntries: ${missingIds.join(', ')}`);
        }
        entriesToWrite.push(...linkedRows.results.map(row => {
            const linked = entryRowToObject(row);
            return {
                ...linked,
                linkedEntries: [...new Set([...(linked.linkedEntries ?? []), entry.id])],
            };
        }));
    }

    const mutations: RevisionMutation[] = entriesToWrite.map(value => ({
        mutationId: `mcp-${crypto.randomUUID()}`,
        entityType: 'entry',
        entityId: value.id,
        operation: 'upsert',
        value,
    }));
    let revision = 0;
    let lastModified = Date.now();
    let notionSync: NotionSyncStatus = { pending: 0, failed: 0 };
    for (let index = 0; index < mutations.length; index += MAX_MUTATIONS_PER_REQUEST) {
        const result = await applyMutationsWithNotionSync(env, mutations.slice(index, index + MAX_MUTATIONS_PER_REQUEST));
        revision = result.revision;
        lastModified = result.lastModified;
        if (result.notionSync) notionSync = result.notionSync;
    }

    return {
        success: true,
        entry: toCompactEntry({
            id: entry.id,
            type: entry.type,
            content: entry.content,
            timestamp: entry.timestamp,
            session_id: entry.sessionId ?? null,
            category: entry.category ?? null,
            content_type: entry.contentType ?? 'note',
            field_values: entry.fieldValues ? JSON.stringify(entry.fieldValues) : null,
            linked_entries: entry.linkedEntries ? JSON.stringify(entry.linkedEntries) : null,
            tags: entry.tags ? JSON.stringify(entry.tags) : null,
            created_at: lastModified,
            updated_at: lastModified,
            revision,
        }, timeZone),
        lastModified,
        notionSync,
    };
}

async function searchEntries(args: Record<string, unknown>, db: D1Database): Promise<unknown> {
    const rawKeywords = Array.isArray(args.keywords) ? args.keywords : [args.keywords];
    const keywords = rawKeywords.filter((k): k is string => typeof k === 'string' && k.trim() !== '').slice(0, 8);
    if (keywords.length === 0) throw new Error('keywords must be a non-empty array of strings');

    const timeZone = resolveTimezone(args.timezone);
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
        bindings.push(dayStartMs(args.start, timeZone));
    }
    if (args.end !== undefined) {
        conditions.push('timestamp <= ?');
        bindings.push(dayStartMs(args.end, timeZone) + DAY_MS - 1);
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
        entries: result.results.map(row => toCompactEntry(row, timeZone)),
    };
}

async function getDay(args: Record<string, unknown>, db: D1Database): Promise<unknown> {
    const timeZone = resolveTimezone(args.timezone);
    const start = dayStartMs(args.date, timeZone);
    const end = start + DAY_MS - 1;

    const result = await db
        .prepare('SELECT * FROM entries WHERE timestamp >= ? AND timestamp <= ? ORDER BY timestamp ASC')
        .bind(start, end)
        .all<EntryRow>();

    const sessions = await getSessionsForRange(db, start, end);
    const sessionDurations = new Map(
        sessions.map(session => [session.startId, session.durationMs])
    );
    const byCategory: Record<string, number> = {};
    let totalMs = 0;
    for (const session of sessions) {
        const key = session.category || 'uncategorized';
        byCategory[key] = (byCategory[key] || 0) + session.durationMs;
        totalMs += session.durationMs;
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
        entries: result.results.map(row => toCompactEntry(row, timeZone, sessionDurations)),
    };
}

async function getStats(args: Record<string, unknown>, db: D1Database): Promise<unknown> {
    const timeZone = resolveTimezone(args.timezone);
    const start = dayStartMs(args.start, timeZone);
    const end = dayStartMs(args.end, timeZone) + DAY_MS - 1;
    if (end < start) throw new Error('end date is before start date');

    const sessions = await getSessionsForRange(db, start, end);

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
    for (const session of sessions) {
        const stats = get(session.category);
        stats.trackedMs += session.durationMs;
        stats.sessions += 1;
    }
    for (const row of counts.results) {
        get(row.category).entries = row.entry_count;
    }

    const totalMs = sessions.reduce((sum, session) => sum + session.durationMs, 0);
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

async function callTool(
    params: Record<string, unknown> | undefined,
    env: Env,
    canWrite: boolean,
): Promise<unknown> {
    const db = env.CHRONOLOG_DB;
    const name = params?.name;
    const args = (params?.arguments ?? {}) as Record<string, unknown>;

    try {
        let data: unknown;
        switch (name) {
            case 'add_entry':
                if (!canWrite) throw new Error('add_entry requires MCP_WRITE_TOKEN');
                data = await addEntry(args, env);
                break;
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

async function handleMessage(message: unknown, env: Env, canWrite: boolean): Promise<JsonRpcResponse | null> {
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
            result = { tools: toolsForAccess(canWrite) };
            break;
        case 'tools/call':
            result = await callTool(params, env, canWrite);
            break;
        default:
            return id === undefined ? null : rpcError(id ?? null, -32601, `Method not found: ${method}`);
    }

    return id === undefined ? null : rpcResult(id ?? null, result);
}

// --- HTTP handlers ---

export async function onRequestPost(context: CFContext): Promise<Response> {
    const { request, env } = context;

    if (!env.PUBLIC_API_TOKEN && !env.MCP_WRITE_TOKEN && !env.DASHBOARD_MCP_TOKEN) {
        return Response.json({ error: 'MCP server not configured' }, { status: 503 });
    }

    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.startsWith('Bearer ')
        ? authHeader.slice(7)
        : new URL(request.url).searchParams.get('token');
    const canWrite = !!token && (
        (!!env.MCP_WRITE_TOKEN && token === env.MCP_WRITE_TOKEN) ||
        (!!env.DASHBOARD_MCP_TOKEN && token === env.DASHBOARD_MCP_TOKEN)
    );
    const canRead = canWrite || (!!env.PUBLIC_API_TOKEN && token === env.PUBLIC_API_TOKEN);
    if (!canRead) {
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
            const responses = (await Promise.all(body.map(msg => handleMessage(msg, env, canWrite))))
                .filter((r): r is JsonRpcResponse => r !== null);
            return responses.length === 0 ? new Response(null, { status: 202 }) : Response.json(responses);
        }
        const response = await handleMessage(body, env, canWrite);
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
