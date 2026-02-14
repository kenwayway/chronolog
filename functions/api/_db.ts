// Shared D1 helper functions for consistent row <-> object mapping

import type { EntryRow, ContentTypeRow, MediaItemRow, Entry, ContentType, MediaItem } from './types.ts';

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
    if (row.duration != null) entry.duration = row.duration;
    if (row.category) entry.category = row.category;
    if (row.content_type && row.content_type !== 'note') entry.contentType = row.content_type;
    if (row.ai_comment) entry.aiComment = row.ai_comment;

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
    duration: number | null;
    category: string | null;
    content_type: string;
    field_values: string | null;
    linked_entries: string | null;
    tags: string | null;
    ai_comment: string | null;
    created_at: number;
    updated_at: number;
}

/**
 * Convert a frontend Entry object (camelCase) to D1 row values (snake_case)
 * Stringifies JSON fields
 */
export function entryObjectToRow(entry: Entry): EntryRowValues {
    const now = Date.now();
    return {
        id: entry.id,
        type: entry.type,
        content: entry.content || '',
        timestamp: entry.timestamp,
        session_id: entry.sessionId || null,
        duration: entry.duration ?? null,
        category: entry.category || null,
        content_type: entry.contentType || 'note',
        field_values: entry.fieldValues ? JSON.stringify(entry.fieldValues) : null,
        linked_entries: entry.linkedEntries ? JSON.stringify(entry.linkedEntries) : null,
        tags: entry.tags ? JSON.stringify(entry.tags) : null,
        ai_comment: entry.aiComment || null,
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
    return {
        id: row.id,
        title: row.title,
        mediaType: row.media_type,
        notionUrl: row.notion_url || undefined,
        createdAt: row.created_at,
    };
}

interface MediaItemRowValues {
    id: string;
    title: string;
    media_type: string;
    notion_url: string | null;
    created_at: number;
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
        created_at: item.createdAt || Date.now(),
    };
}

/**
 * Upsert entries into D1 in batches
 */
export async function upsertEntries(db: D1Database, entries: Entry[]): Promise<number> {
    if (!entries || entries.length === 0) return 0;

    const stmt = db.prepare(`
    INSERT INTO entries
      (id, type, content, timestamp, session_id, duration, category, content_type,
       field_values, linked_entries, tags, ai_comment, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      type = excluded.type,
      content = excluded.content,
      timestamp = excluded.timestamp,
      session_id = excluded.session_id,
      duration = excluded.duration,
      category = excluded.category,
      content_type = excluded.content_type,
      field_values = excluded.field_values,
      linked_entries = excluded.linked_entries,
      tags = excluded.tags,
      ai_comment = excluded.ai_comment,
      updated_at = excluded.updated_at
  `);

    const batches: D1PreparedStatement[] = [];
    for (const entry of entries) {
        const row = entryObjectToRow(entry);
        batches.push(stmt.bind(
            row.id, row.type, row.content, row.timestamp,
            row.session_id, row.duration, row.category, row.content_type,
            row.field_values, row.linked_entries, row.tags, row.ai_comment,
            row.created_at, row.updated_at
        ));
    }

    // D1 batch limit is 100 statements
    let total = 0;
    for (let i = 0; i < batches.length; i += 100) {
        const chunk = batches.slice(i, i + 100);
        const results = await db.batch(chunk);
        total += results.reduce((sum, r) => sum + (r.meta?.changes || 0), 0);
    }

    return total;
}

/**
 * Upsert content types into D1
 */
export async function upsertContentTypes(db: D1Database, contentTypes: ContentType[]): Promise<number> {
    if (!contentTypes || contentTypes.length === 0) return 0;

    const stmt = db.prepare(`
    INSERT OR REPLACE INTO content_types
      (id, name, icon, color, fields, built_in, sort_order)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

    const batches = contentTypes.map(ct => {
        const row = contentTypeObjectToRow(ct);
        return stmt.bind(row.id, row.name, row.icon, row.color, row.fields, row.built_in, row.sort_order);
    });

    const results = await db.batch(batches);
    return results.reduce((sum, r) => sum + (r.meta?.changes || 0), 0);
}

/**
 * Upsert media items into D1
 */
export async function upsertMediaItems(db: D1Database, mediaItems: MediaItem[]): Promise<number> {
    if (!mediaItems || mediaItems.length === 0) return 0;

    const stmt = db.prepare(`
    INSERT OR REPLACE INTO media_items
      (id, title, media_type, notion_url, created_at)
    VALUES (?, ?, ?, ?, ?)
  `);

    const batches = mediaItems.map(item => {
        const row = mediaItemObjectToRow(item);
        return stmt.bind(row.id, row.title, row.media_type, row.notion_url, row.created_at);
    });

    const results = await db.batch(batches);
    return results.reduce((sum, r) => sum + (r.meta?.changes || 0), 0);
}

/**
 * Get the last_modified timestamp from sync_meta
 */
export async function getLastModified(db: D1Database): Promise<number | null> {
    const row = await db.prepare("SELECT value FROM sync_meta WHERE key = 'last_modified'").first<{ value: string }>();
    return row ? parseInt(row.value, 10) : null;
}

/**
 * Set the last_modified timestamp in sync_meta
 */
export async function setLastModified(db: D1Database, timestamp: number): Promise<void> {
    await db.prepare(
        "INSERT OR REPLACE INTO sync_meta (key, value) VALUES ('last_modified', ?)"
    ).bind(String(timestamp)).run();
}
