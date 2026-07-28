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

export interface RejectedMutation {
    mutationId: string;
    entityType: SyncEntityType;
    entityId: string;
    reason: 'invalid' | 'deleted';
    detail?: string;
}

export interface ValidatedMutations {
    accepted: RevisionMutation[];
    rejected: RejectedMutation[];
}

export const MAX_MUTATIONS_PER_REQUEST = 20;

function commitStatement(db: D1Database, mutation: RevisionMutation, now: number) {
    return db.prepare(
        'INSERT OR IGNORE INTO sync_commits (mutation_id, committed_at) VALUES (?, ?)'
    ).bind(mutation.mutationId, now);
}

function upsertNoteStatement(db: D1Database, mutation: RevisionMutation, now: number) {
    const row = noteObjectToRow(mutation.value as Note, now);
    return db.prepare(`
        INSERT INTO notes
          (id, content, timestamp, session_id, category, content_type,
           field_values, linked_items, tags, origin, created_at, updated_at, revision)
        SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, sync_commit.revision
        FROM sync_commits AS sync_commit
        WHERE sync_commit.mutation_id = ?
          AND NOT EXISTS (
            SELECT 1 FROM sync_tombstones AS tombstone
            WHERE tombstone.entity_type = 'note' AND tombstone.entity_id = ?
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
          origin = excluded.origin,
          updated_at = excluded.updated_at,
          revision = excluded.revision
        WHERE excluded.revision >= notes.revision
    `).bind(
        row.id, row.content, row.timestamp, row.session_id, row.category,
        row.content_type, row.field_values, row.linked_items, row.tags,
        row.origin, row.created_at, row.updated_at, mutation.mutationId, row.id,
    );
}

function upsertSessionStatement(db: D1Database, mutation: RevisionMutation, now: number) {
    const row = sessionObjectToRow(mutation.value as Session, now);
    return db.prepare(`
        INSERT INTO sessions
          (id, content, start_at, end_at, end_content, category, content_type,
           field_values, linked_items, tags, end_tags, origin, created_at, updated_at, revision)
        SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, sync_commit.revision
        FROM sync_commits AS sync_commit
        WHERE sync_commit.mutation_id = ?
          AND NOT EXISTS (
            SELECT 1 FROM sync_tombstones AS tombstone
            WHERE tombstone.entity_type = 'session' AND tombstone.entity_id = ?
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
          origin = excluded.origin,
          updated_at = excluded.updated_at,
          revision = excluded.revision
        WHERE excluded.revision >= sessions.revision
    `).bind(
        row.id, row.content, row.start_at, row.end_at, row.end_content,
        row.category, row.content_type, row.field_values, row.linked_items,
        row.tags, row.end_tags, row.origin, row.created_at, row.updated_at,
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
    return statements;
}

function invalidValueReason(mutation: RevisionMutation): string | null {
    if (mutation.operation !== 'upsert') return null;
    if (!mutation.value || typeof mutation.value !== 'object' || (mutation.value as { id?: unknown }).id !== mutation.entityId) {
        return 'upsert value must match entityId';
    }
    const value = mutation.value as unknown as Record<string, unknown>;
    if (value.origin !== undefined && value.origin !== 'zaddy') {
        return 'invalid origin';
    }
    if (
        mutation.entityType === 'note'
        && (
            typeof value.content !== 'string'
            || typeof value.timestamp !== 'number'
            || !Number.isFinite(value.timestamp)
        )
    ) {
        return 'invalid note value';
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
        return 'invalid session value';
    }
    if (
        mutation.entityType === 'contentType'
        && (typeof value.name !== 'string' || !Array.isArray(value.fields))
    ) {
        return 'invalid contentType value';
    }
    if (
        mutation.entityType === 'mediaItem'
        && (typeof value.title !== 'string' || typeof value.mediaType !== 'string')
    ) {
        return 'invalid mediaItem value';
    }
    return null;
}

/**
 * Validate a mutation batch without letting one bad mutation poison the rest.
 *
 * Batch-shape problems and mutations whose mutationId is unusable still throw:
 * the client cannot acknowledge those by ID, and our client can never produce
 * them. Every other per-mutation problem lands in `rejected` so the caller can
 * apply the valid mutations and tell the client which IDs to discard.
 */
export function validateRevisionMutations(input: unknown): ValidatedMutations {
    if (!Array.isArray(input)) throw new Error('mutations must be an array');
    if (input.length > MAX_MUTATIONS_PER_REQUEST) {
        throw new Error(`at most ${MAX_MUTATIONS_PER_REQUEST} mutations are allowed per request`);
    }

    const validTypes = new Set<SyncEntityType>(['note', 'session', 'contentType', 'mediaItem']);
    const accepted: RevisionMutation[] = [];
    const rejected: RejectedMutation[] = [];

    input.forEach((candidate, index) => {
        if (!candidate || typeof candidate !== 'object') throw new Error(`mutation ${index} must be an object`);
        const mutation = candidate as Partial<RevisionMutation>;
        if (typeof mutation.mutationId !== 'string' || !mutation.mutationId || mutation.mutationId.length > 150) {
            throw new Error(`mutation ${index} has an invalid mutationId`);
        }

        const reject = (detail: string) => rejected.push({
            mutationId: mutation.mutationId as string,
            entityType: (validTypes.has(mutation.entityType as SyncEntityType)
                ? mutation.entityType
                : 'note') as SyncEntityType,
            entityId: typeof mutation.entityId === 'string' ? mutation.entityId : '',
            reason: 'invalid',
            detail,
        });

        if (!validTypes.has(mutation.entityType as SyncEntityType)) return reject('invalid entityType');
        if (typeof mutation.entityId !== 'string' || !mutation.entityId || mutation.entityId.length > 150) {
            return reject('invalid entityId');
        }
        if (mutation.operation !== 'upsert' && mutation.operation !== 'delete') {
            return reject('invalid operation');
        }
        const valueProblem = invalidValueReason(mutation as RevisionMutation);
        if (valueProblem) return reject(valueProblem);
        accepted.push(mutation as RevisionMutation);
    });

    return { accepted, rejected };
}

export async function currentRevision(db: D1Database): Promise<number> {
    const row = await db.prepare('SELECT COALESCE(MAX(revision), 0) AS revision FROM sync_commits')
        .first<{ revision: number }>();
    return Number(row?.revision ?? 0);
}

/** Rows a paged pull returns at most per response, across all entity tables. */
export const PULL_PAGE_SIZE = 800;

/**
 * Find the revision that closes a page of at most PULL_PAGE_SIZE rows after
 * `sinceRevision`. Returns null when everything remaining fits in one page.
 * Revisions are unique across tables (one commit per mutation), so counting
 * the union is exact.
 */
export async function pageEndRevision(
    db: D1Database,
    sinceRevision: number,
): Promise<number | null> {
    const row = await db.prepare(`
        SELECT revision FROM (
            SELECT revision FROM notes WHERE revision > ?1
            UNION ALL SELECT revision FROM sessions WHERE revision > ?1
            UNION ALL SELECT revision FROM content_types WHERE revision > ?1
            UNION ALL SELECT revision FROM media_items WHERE revision > ?1
            UNION ALL SELECT revision FROM sync_tombstones WHERE revision > ?1
        ) ORDER BY revision LIMIT 1 OFFSET ?2
    `).bind(sinceRevision, PULL_PAGE_SIZE - 1).first<{ revision: number }>();
    return row ? Number(row.revision) : null;
}

const SYNC_GC_INTERVAL_MS = 24 * 60 * 60 * 1000;
const SYNC_COMMIT_RETENTION_MS = 90 * 24 * 60 * 60 * 1000;

/**
 * Bound sync bookkeeping growth. Old sync_commits rows only serve retry
 * idempotency and revision assignment, so anything past the retention window
 * (except the newest row, which anchors currentRevision) can go. Tombstones
 * are deliberately kept forever: they are tiny and are what prevents deleted
 * entities from being resurrected by stale devices.
 */
export async function collectSyncGarbage(db: D1Database, now = Date.now()): Promise<void> {
    const last = await db.prepare(
        "SELECT value FROM sync_meta WHERE key = 'last_sync_gc'"
    ).first<{ value: string }>();
    if (last && now - Number(last.value) < SYNC_GC_INTERVAL_MS) return;

    await db.batch([
        db.prepare(
            "INSERT OR REPLACE INTO sync_meta (key, value) VALUES ('last_sync_gc', ?)"
        ).bind(String(now)),
        db.prepare(
            'DELETE FROM sync_commits WHERE committed_at < ? ' +
            'AND revision < (SELECT MAX(revision) FROM sync_commits)'
        ).bind(now - SYNC_COMMIT_RETENTION_MS),
    ]);
}

/**
 * Tombstones win: once an entity is deleted, no upsert may recreate it.
 * The upsert statements enforce this in SQL; this pre-read exists so the
 * response can tell the client which mutations were refused and why.
 */
async function tombstonedEntityKeys(
    db: D1Database,
    upserts: RevisionMutation[],
): Promise<Set<string>> {
    if (upserts.length === 0) return new Set();
    const condition = upserts.map(() => '(entity_type = ? AND entity_id = ?)').join(' OR ');
    const result = await db.prepare(
        `SELECT entity_type, entity_id FROM sync_tombstones WHERE ${condition}`
    ).bind(...upserts.flatMap(mutation => [mutation.entityType, mutation.entityId]))
        .all<{ entity_type: SyncEntityType; entity_id: string }>();
    return new Set(result.results.map(row => `${row.entity_type}:${row.entity_id}`));
}

export async function applyRevisionMutations(
    db: D1Database,
    mutations: RevisionMutation[],
): Promise<{
    revision: number;
    appliedMutationIds: string[];
    rejectedMutations: RejectedMutation[];
    lastModified: number;
}> {
    if (mutations.length > MAX_MUTATIONS_PER_REQUEST) {
        throw new Error(`at most ${MAX_MUTATIONS_PER_REQUEST} mutations are allowed per request`);
    }

    const tombstoned = await tombstonedEntityKeys(
        db,
        mutations.filter(mutation => mutation.operation === 'upsert'),
    );
    const rejectedMutations: RejectedMutation[] = [];
    const applicable = mutations.filter(mutation => {
        if (mutation.operation !== 'upsert') return true;
        if (!tombstoned.has(`${mutation.entityType}:${mutation.entityId}`)) return true;
        rejectedMutations.push({
            mutationId: mutation.mutationId,
            entityType: mutation.entityType,
            entityId: mutation.entityId,
            reason: 'deleted',
            detail: 'entity was deleted on another device',
        });
        return false;
    });

    const now = Date.now();
    if (applicable.length > 0) {
        const statements = applicable.flatMap(mutation => mutationStatements(db, mutation, now));
        statements.push(db.prepare(
            "INSERT OR REPLACE INTO sync_meta (key, value) VALUES ('last_modified', ?)"
        ).bind(String(now)));
        await db.batch(statements);
    }
    return {
        revision: await currentRevision(db),
        appliedMutationIds: applicable.map(mutation => mutation.mutationId),
        rejectedMutations,
        lastModified: now,
    };
}
