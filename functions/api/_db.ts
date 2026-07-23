// Shared D1 helper functions for consistent row <-> object mapping

import type { EntryRow, ContentTypeRow, MediaItemRow, Entry, ContentType, MediaItem } from './types.ts';
import { CATEGORY_IDS } from '../../src/utils/categories.ts';

/**
 * Convert a D1 entry row (snake_case) to a frontend Entry object (camelCase)
 * Parses JSON string fields back into objects/arrays
 */
export function entryRowToObject(row: EntryRow): Entry {
    const entry: Entry = {
        id: row.id,
        type: row.type,
        content: row.content,
        timestamp: row.timestamp,
    };

    if (row.session_id) entry.sessionId = row.session_id;
    if (row.category) entry.category = row.category;
    if (row.content_type && row.content_type !== 'note') entry.contentType = row.content_type;

    // Parse JSON fields
    if (row.field_values) {
        try { entry.fieldValues = JSON.parse(row.field_values); } catch { /* ignore */ }
    }
    if (row.linked_entries) {
        try {
            const parsed = JSON.parse(row.linked_entries);
            if (Array.isArray(parsed) && parsed.length > 0) entry.linkedEntries = parsed;
        } catch { /* ignore */ }
    }
    if (row.tags) {
        try {
            const parsed = JSON.parse(row.tags);
            if (Array.isArray(parsed) && parsed.length > 0) entry.tags = parsed;
        } catch { /* ignore */ }
    }

    return entry;
}

interface EntryRowValues {
    id: string;
    type: string;
    content: string;
    timestamp: number;
    session_id: string | null;
    category: string | null;
    content_type: string;
    field_values: string | null;
    linked_entries: string | null;
    tags: string | null;
    created_at: number;
    updated_at: number;
}

/**
 * Convert a frontend Entry object (camelCase) to D1 row values (snake_case)
 * Stringifies JSON fields
 */
export function entryObjectToRow(entry: Entry, now: number = Date.now()): EntryRowValues {
    return {
        id: entry.id,
        type: entry.type,
        content: entry.content || '',
        timestamp: entry.timestamp,
        session_id: entry.sessionId || null,
        // Categories are a fixed set; drop unknown values instead of rejecting the batch
        category: entry.category && CATEGORY_IDS.includes(entry.category) ? entry.category : null,
        content_type: entry.contentType || 'note',
        field_values: entry.fieldValues ? JSON.stringify(entry.fieldValues) : null,
        linked_entries: entry.linkedEntries ? JSON.stringify(entry.linkedEntries) : null,
        tags: entry.tags ? JSON.stringify(entry.tags) : null,
        created_at: now,
        updated_at: now,
    };
}

/**
 * Convert a D1 content_type row to a frontend ContentType object
 */
export function contentTypeRowToObject(row: ContentTypeRow): ContentType {
    const ct: ContentType = {
        id: row.id,
        name: row.name,
        fields: [],
        order: row.sort_order || 0,
    };

    if (row.icon) ct.icon = row.icon;
    if (row.color) ct.color = row.color;
    if (row.built_in) ct.builtIn = true;

    if (row.fields) {
        try { ct.fields = JSON.parse(row.fields); } catch { ct.fields = []; }
    }

    return ct;
}

interface ContentTypeRowValues {
    id: string;
    name: string;
    icon: string | null;
    color: string | null;
    fields: string;
    built_in: number;
    sort_order: number;
}

/**
 * Convert a frontend ContentType object to D1 row values
 */
export function contentTypeObjectToRow(ct: ContentType): ContentTypeRowValues {
    return {
        id: ct.id,
        name: ct.name,
        icon: ct.icon || null,
        color: ct.color || null,
        fields: JSON.stringify(ct.fields || []),
        built_in: ct.builtIn ? 1 : 0,
        sort_order: ct.order ?? 0,
    };
}

/**
 * Convert a D1 media_item row to a frontend MediaItem object
 */
export function mediaItemRowToObject(row: MediaItemRow): MediaItem {
    const item: MediaItem = {
        id: row.id,
        title: row.title,
        mediaType: row.media_type,
        notionUrl: row.notion_url || undefined,
        coverUrl: row.cover_url || undefined,
        spotifyUrl: row.spotify_url || undefined,
        createdAt: row.created_at,
    };

    if (row.rating != null) item.rating = row.rating;
    if (row.status) item.status = row.status;
    if (row.date_finished) item.dateFinished = row.date_finished;
    if (row.notes) item.notes = row.notes;
    if (row.metadata) {
        try { item.metadata = JSON.parse(row.metadata); } catch { /* ignore */ }
    }

    return item;
}

interface MediaItemRowValues {
    id: string;
    title: string;
    media_type: string;
    notion_url: string | null;
    cover_url: string | null;
    spotify_url: string | null;
    created_at: number;
    rating: number | null;
    status: string | null;
    date_finished: string | null;
    notes: string | null;
    metadata: string | null;
}

/**
 * Convert a frontend MediaItem object to D1 row values
 */
export function mediaItemObjectToRow(item: MediaItem): MediaItemRowValues {
    return {
        id: item.id,
        title: item.title,
        media_type: item.mediaType,
        notion_url: item.notionUrl || null,
        cover_url: item.coverUrl || null,
        spotify_url: item.spotifyUrl || null,
        created_at: item.createdAt || Date.now(),
        rating: item.rating ?? null,
        status: item.status || null,
        date_finished: item.dateFinished || null,
        notes: item.notes || null,
        metadata: item.metadata ? JSON.stringify(item.metadata) : null,
    };
}

/**
 * Get the last_modified timestamp from sync_meta
 */
export async function getLastModified(db: D1Database): Promise<number | null> {
    const row = await db.prepare("SELECT value FROM sync_meta WHERE key = 'last_modified'").first<{ value: string }>();
    return row ? parseInt(row.value, 10) : null;
}
