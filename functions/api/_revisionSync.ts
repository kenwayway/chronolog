import {
    contentTypeObjectToRow,
    mediaItemObjectToRow,
    noteObjectToRow,
    sessionObjectToRow,
} from './_db.ts';
import type { ContentType, MediaItem, Note, Session } from './types.ts';

export type SyncEntityType = 'note' | 'session' | 'contentType' | 'mediaItem';
export type SyncOperation = 'upsert' | 'delete';
export type SyncEntity = Note | Session | ContentType | MediaItem;

export interface RevisionMutation {
    mutationId: string;
    entityType: SyncEntityType;
    entityId: string;
    operation: SyncOperation;
    value?: SyncEntity;
}

export const MAX_MUTATIONS_PER_REQUEST = 20;

function commitStatement(db: D1Database, mutation: RevisionMutation, now: number) {
    return db.prepare(
        'INSERT OR IGNORE INTO sync_commits (mutation_id, committed_at) VALUES (?, ?)'
    ).bind(mutation.mutationId, now);
}

function clearOlderTombstone(db: D1Database, mutation: RevisionMutation) {
    return db.prepare(
        'DELETE FROM sync_tombstones WHERE entity_type = ? AND entity_id = ? ' +
        'AND revision <= (SELECT revision FROM sync_commits WHERE mutation_id = ?)'
    ).bind(mutation.entityType, mutation.entityId, mutation.mutationId);
}

function upsertNoteStatement(db: D1Database, mutation: RevisionMutation, now: number) {
    const row = noteObjectToRow(mutation.value as Note, now);
    return db.prepare(`
        INSERT INTO notes
          (id, content, timestamp, session_id, category, content_type,
           field_values, linked_items, tags, created_at, updated_at, revision)
        SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, sync_commit.revision
        FROM sync_commits AS sync_commit
        WHERE sync_commit.mutation_id = ?
          AND NOT EXISTS (
            SELECT 1 FROM sync_tombstones AS tombstone
            WHERE tombstone.entity_type = 'note' AND tombstone.entity_id = ?
              AND tombstone.revision > sync_commit.revision
          )
        ON CONFLICT(id) DO UPDATE SET
          content = excluded.content,
          timestamp = excluded.timestamp,
          session_id = excluded.session_id,
          category = excluded.category,
          content_type = excluded.content_type,
          field_values = excluded.field_values,
          linked_items = excluded.linked_items,
          tags = excluded.tags,
          updated_at = excluded.updated_at,
          revision = excluded.revision
        WHERE excluded.revision >= notes.revision
    `).bind(
        row.id, row.content, row.timestamp, row.session_id, row.category,
        row.content_type, row.field_values, row.linked_items, row.tags,
        row.created_at, row.updated_at, mutation.mutationId, row.id,
    );
}

function upsertSessionStatement(db: D1Database, mutation: RevisionMutation, now: number) {
    const row = sessionObjectToRow(mutation.value as Session, now);
    return db.prepare(`
        INSERT INTO sessions
          (id, content, start_at, end_at, end_content, category, content_type,
           field_values, linked_items, tags, end_tags, created_at, updated_at, revision)
        SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, sync_commit.revision
        FROM sync_commits AS sync_commit
        WHERE sync_commit.mutation_id = ?
          AND NOT EXISTS (
            SELECT 1 FROM sync_tombstones AS tombstone
            WHERE tombstone.entity_type = 'session' AND tombstone.entity_id = ?
              AND tombstone.revision > sync_commit.revision
          )
        ON CONFLICT(id) DO UPDATE SET
          content = excluded.content,
          start_at = excluded.start_at,
          end_at = excluded.end_at,
          end_content = excluded.end_content,
          category = excluded.category,
          content_type = excluded.content_type,
          field_values = excluded.field_values,
          linked_items = excluded.linked_items,
          tags = excluded.tags,
          end_tags = excluded.end_tags,
          updated_at = excluded.updated_at,
          revision = excluded.revision
        WHERE excluded.revision >= sessions.revision
    `).bind(
        row.id, row.content, row.start_at, row.end_at, row.end_content,
        row.category, row.content_type, row.field_values, row.linked_items,
        row.tags, row.end_tags, row.created_at, row.updated_at,
        mutation.mutationId, row.id,
    );
}

function upsertContentTypeStatement(db: D1Database, mutation: RevisionMutation) {
    const row = contentTypeObjectToRow(mutation.value as ContentType);
    return db.prepare(`
        INSERT INTO content_types
          (id, name, icon, color, fields, built_in, sort_order, revision)
        SELECT ?, ?, ?, ?, ?, ?, ?, sync_commit.revision
        FROM sync_commits AS sync_commit
        WHERE sync_commit.mutation_id = ?
          AND NOT EXISTS (
            SELECT 1 FROM sync_tombstones AS tombstone
            WHERE tombstone.entity_type = 'contentType' AND tombstone.entity_id = ?
              AND tombstone.revision > sync_commit.revision
          )
        ON CONFLICT(id) DO UPDATE SET
          name = excluded.name, icon = excluded.icon, color = excluded.color,
          fields = excluded.fields, built_in = excluded.built_in,
          sort_order = excluded.sort_order, revision = excluded.revision
        WHERE excluded.revision >= content_types.revision
    `).bind(
        row.id, row.name, row.icon, row.color, row.fields, row.built_in,
        row.sort_order, mutation.mutationId, row.id,
    );
}

function upsertMediaItemStatement(db: D1Database, mutation: RevisionMutation) {
    const row = mediaItemObjectToRow(mutation.value as MediaItem);
    return db.prepare(`
        INSERT INTO media_items
          (id, title, media_type, notion_url, cover_url, spotify_url, created_at,
           rating, status, date_finished, notes, metadata, revision)
        SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, sync_commit.revision
        FROM sync_commits AS sync_commit
        WHERE sync_commit.mutation_id = ?
          AND NOT EXISTS (
            SELECT 1 FROM sync_tombstones AS tombstone
            WHERE tombstone.entity_type = 'mediaItem' AND tombstone.entity_id = ?
              AND tombstone.revision > sync_commit.revision
          )
        ON CONFLICT(id) DO UPDATE SET
          title = excluded.title, media_type = excluded.media_type,
          notion_url = excluded.notion_url, cover_url = excluded.cover_url,
          spotify_url = excluded.spotify_url, created_at = excluded.created_at,
          rating = excluded.rating, status = excluded.status,
          date_finished = excluded.date_finished, notes = excluded.notes,
          metadata = excluded.metadata, revision = excluded.revision
        WHERE excluded.revision >= media_items.revision
    `).bind(
        row.id, row.title, row.media_type, row.notion_url, row.cover_url,
        row.spotify_url, row.created_at, row.rating, row.status,
        row.date_finished, row.notes, row.metadata, mutation.mutationId, row.id,
    );
}

function deleteStatements(db: D1Database, mutation: RevisionMutation): D1PreparedStatement[] {
    const table = mutation.entityType === 'note'
        ? 'notes'
        : mutation.entityType === 'session'
            ? 'sessions'
            : mutation.entityType === 'contentType' ? 'content_types' : 'media_items';
    return [
        db.prepare(
            `DELETE FROM ${table} WHERE id = ? AND revision <= ` +
            '(SELECT revision FROM sync_commits WHERE mutation_id = ?)'
        ).bind(mutation.entityId, mutation.mutationId),
        db.prepare(`
            INSERT INTO sync_tombstones (entity_type, entity_id, revision)
            SELECT ?, ?, revision FROM sync_commits WHERE mutation_id = ?
            ON CONFLICT(entity_type, entity_id) DO UPDATE SET revision = excluded.revision
            WHERE excluded.revision >= sync_tombstones.revision
        `).bind(mutation.entityType, mutation.entityId, mutation.mutationId),
    ];
}

function mutationStatements(db: D1Database, mutation: RevisionMutation, now: number): D1PreparedStatement[] {
    const statements = [commitStatement(db, mutation, now)];
    if (mutation.operation === 'delete') return [...statements, ...deleteStatements(db, mutation)];
    if (mutation.entityType === 'note') statements.push(upsertNoteStatement(db, mutation, now));
    if (mutation.entityType === 'session') statements.push(upsertSessionStatement(db, mutation, now));
    if (mutation.entityType === 'contentType') statements.push(upsertContentTypeStatement(db, mutation));
    if (mutation.entityType === 'mediaItem') statements.push(upsertMediaItemStatement(db, mutation));
    statements.push(clearOlderTombstone(db, mutation));
    return statements;
}

export function validateRevisionMutations(input: unknown): RevisionMutation[] {
    if (!Array.isArray(input)) throw new Error('mutations must be an array');
    if (input.length > MAX_MUTATIONS_PER_REQUEST) {
        throw new Error(`at most ${MAX_MUTATIONS_PER_REQUEST} mutations are allowed per request`);
    }

    const validTypes = new Set<SyncEntityType>(['note', 'session', 'contentType', 'mediaItem']);
    return input.map((candidate, index) => {
        if (!candidate || typeof candidate !== 'object') throw new Error(`mutation ${index} must be an object`);
        const mutation = candidate as Partial<RevisionMutation>;
        if (typeof mutation.mutationId !== 'string' || !mutation.mutationId || mutation.mutationId.length > 150) {
            throw new Error(`mutation ${index} has an invalid mutationId`);
        }
        if (!validTypes.has(mutation.entityType as SyncEntityType)) throw new Error(`mutation ${index} has an invalid entityType`);
        if (typeof mutation.entityId !== 'string' || !mutation.entityId || mutation.entityId.length > 150) {
            throw new Error(`mutation ${index} has an invalid entityId`);
        }
        if (mutation.operation !== 'upsert' && mutation.operation !== 'delete') {
            throw new Error(`mutation ${index} has an invalid operation`);
        }
        if (mutation.operation === 'upsert') {
            if (!mutation.value || typeof mutation.value !== 'object' || (mutation.value as { id?: unknown }).id !== mutation.entityId) {
                throw new Error(`mutation ${index} upsert value must match entityId`);
            }
            const value = mutation.value as unknown as Record<string, unknown>;
            if (
                mutation.entityType === 'note'
                && (
                    typeof value.content !== 'string'
                    || typeof value.timestamp !== 'number'
                    || !Number.isFinite(value.timestamp)
                )
            ) {
                throw new Error(`mutation ${index} has an invalid note value`);
            }
            if (
                mutation.entityType === 'session'
                && (
                    typeof value.content !== 'string'
                    || typeof value.startAt !== 'number'
                    || !Number.isFinite(value.startAt)
                    || (
                        value.endAt !== null
                        && (typeof value.endAt !== 'number' || !Number.isFinite(value.endAt))
                    )
                )
            ) {
                throw new Error(`mutation ${index} has an invalid session value`);
            }
            if (
                mutation.entityType === 'contentType'
                && (typeof value.name !== 'string' || !Array.isArray(value.fields))
            ) {
                throw new Error(`mutation ${index} has an invalid contentType value`);
            }
            if (
                mutation.entityType === 'mediaItem'
                && (typeof value.title !== 'string' || typeof value.mediaType !== 'string')
            ) {
                throw new Error(`mutation ${index} has an invalid mediaItem value`);
            }
        }
        return mutation as RevisionMutation;
    });
}

export async function currentRevision(db: D1Database): Promise<number> {
    const row = await db.prepare('SELECT COALESCE(MAX(revision), 0) AS revision FROM sync_commits')
        .first<{ revision: number }>();
    return Number(row?.revision ?? 0);
}

export async function applyRevisionMutations(
    db: D1Database,
    mutations: RevisionMutation[],
): Promise<{ revision: number; appliedMutationIds: string[]; lastModified: number }> {
    if (mutations.length === 0) {
        return { revision: await currentRevision(db), appliedMutationIds: [], lastModified: Date.now() };
    }
    if (mutations.length > MAX_MUTATIONS_PER_REQUEST) {
        throw new Error(`at most ${MAX_MUTATIONS_PER_REQUEST} mutations are allowed per request`);
    }

    const now = Date.now();
    const statements = mutations.flatMap(mutation => mutationStatements(db, mutation, now));
    statements.push(db.prepare(
        "INSERT OR REPLACE INTO sync_meta (key, value) VALUES ('last_modified', ?)"
    ).bind(String(now)));
    await db.batch(statements);
    return {
        revision: await currentRevision(db),
        appliedMutationIds: mutations.map(mutation => mutation.mutationId),
        lastModified: now,
    };
}
