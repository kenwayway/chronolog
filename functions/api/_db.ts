import type {
    ContentType,
    ContentTypeRow,
    MediaItem,
    MediaItemRow,
    Note,
    NoteRow,
    Session,
    SessionRow,
} from './types.ts';
import { CATEGORY_IDS } from '../../src/utils/categories.ts';

function parseObject(value: string | null): Record<string, unknown> | undefined {
    if (!value) return undefined;
    try {
        const parsed = JSON.parse(value);
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : undefined;
    } catch {
        return undefined;
    }
}

function parseArray(value: string | null): string[] | undefined {
    if (!value) return undefined;
    try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) && parsed.length > 0
            ? parsed.filter(item => typeof item === 'string')
            : undefined;
    } catch {
        return undefined;
    }
}

function validCategory(category?: string): string | null {
    return category && CATEGORY_IDS.includes(category) ? category : null;
}

export function noteRowToObject(row: NoteRow): Note {
    return {
        id: row.id,
        content: row.content,
        timestamp: row.timestamp,
        ...(row.session_id ? { sessionId: row.session_id } : {}),
        ...(row.category ? { category: row.category } : {}),
        ...(row.content_type && row.content_type !== 'note' ? { contentType: row.content_type } : {}),
        ...(parseObject(row.field_values) ? { fieldValues: parseObject(row.field_values) } : {}),
        ...(parseArray(row.linked_items) ? { linkedItems: parseArray(row.linked_items) } : {}),
        ...(parseArray(row.tags) ? { tags: parseArray(row.tags) } : {}),
    };
}

export function sessionRowToObject(row: SessionRow): Session {
    return {
        id: row.id,
        content: row.content,
        startAt: row.start_at,
        endAt: row.end_at,
        ...(row.end_content ? { endContent: row.end_content } : {}),
        ...(row.category ? { category: row.category } : {}),
        ...(row.content_type && row.content_type !== 'note' ? { contentType: row.content_type } : {}),
        ...(parseObject(row.field_values) ? { fieldValues: parseObject(row.field_values) } : {}),
        ...(parseArray(row.linked_items) ? { linkedItems: parseArray(row.linked_items) } : {}),
        ...(parseArray(row.tags) ? { tags: parseArray(row.tags) } : {}),
        ...(parseArray(row.end_tags) ? { endTags: parseArray(row.end_tags) } : {}),
    };
}

export function noteObjectToRow(note: Note, now = Date.now()) {
    return {
        id: note.id,
        content: note.content || '',
        timestamp: note.timestamp,
        session_id: note.sessionId || null,
        category: validCategory(note.category),
        content_type: note.contentType || 'note',
        field_values: note.fieldValues ? JSON.stringify(note.fieldValues) : null,
        linked_items: note.linkedItems ? JSON.stringify(note.linkedItems) : null,
        tags: note.tags ? JSON.stringify(note.tags) : null,
        created_at: now,
        updated_at: now,
    };
}

export function sessionObjectToRow(session: Session, now = Date.now()) {
    return {
        id: session.id,
        content: session.content || '',
        start_at: session.startAt,
        end_at: session.endAt,
        end_content: session.endContent || null,
        category: validCategory(session.category),
        content_type: session.contentType || 'note',
        field_values: session.fieldValues ? JSON.stringify(session.fieldValues) : null,
        linked_items: session.linkedItems ? JSON.stringify(session.linkedItems) : null,
        tags: session.tags ? JSON.stringify(session.tags) : null,
        end_tags: session.endTags ? JSON.stringify(session.endTags) : null,
        created_at: now,
        updated_at: now,
    };
}

export function contentTypeRowToObject(row: ContentTypeRow): ContentType {
    const contentType: ContentType = {
        id: row.id,
        name: row.name,
        fields: [],
        order: row.sort_order || 0,
    };
    if (row.icon) contentType.icon = row.icon;
    if (row.color) contentType.color = row.color;
    if (row.built_in) contentType.builtIn = true;
    if (row.fields) {
        try { contentType.fields = JSON.parse(row.fields); } catch { contentType.fields = []; }
    }
    return contentType;
}

export function contentTypeObjectToRow(contentType: ContentType) {
    return {
        id: contentType.id,
        name: contentType.name,
        icon: contentType.icon || null,
        color: contentType.color || null,
        fields: JSON.stringify(contentType.fields || []),
        built_in: contentType.builtIn ? 1 : 0,
        sort_order: contentType.order ?? 0,
    };
}

export function mediaItemRowToObject(row: MediaItemRow): MediaItem {
    const item: MediaItem = {
        id: row.id,
        title: row.title,
        mediaType: row.media_type,
        createdAt: row.created_at,
    };
    if (row.notion_url) item.notionUrl = row.notion_url;
    if (row.cover_url) item.coverUrl = row.cover_url;
    if (row.spotify_url) item.spotifyUrl = row.spotify_url;
    if (row.rating != null) item.rating = row.rating;
    if (row.status) item.status = row.status;
    if (row.date_finished) item.dateFinished = row.date_finished;
    if (row.notes) item.notes = row.notes;
    if (row.metadata) {
        try { item.metadata = JSON.parse(row.metadata); } catch { /* ignore malformed metadata */ }
    }
    return item;
}

export function mediaItemObjectToRow(item: MediaItem) {
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
