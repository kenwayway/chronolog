// GET /api/data - Fetch user data from D1
// PUT /api/data - Save user data to D1 (incremental upsert)

import { verifyAuth, corsHeaders, unauthorizedResponse } from './_auth.ts';
import {
    entryRowToObject,
    contentTypeRowToObject,
    mediaItemRowToObject,
    getLastModified,
} from './_db.ts';
import {
    currentRevision,
    MAX_MUTATIONS_PER_REQUEST,
    validateRevisionMutations,
    type RevisionMutation,
} from './_revisionSync.ts';
import { applyMutationsWithNotionSync, flushNotionSyncJobs, type NotionSyncStatus } from './_notionSync.ts';
import type { CFContext, Entry, ContentType, MediaItem, EntryRow, ContentTypeRow, MediaItemRow } from './types.ts';

interface TombstoneRow {
    entity_type: 'entry' | 'contentType' | 'mediaItem';
    entity_id: string;
}

async function getRevisionData(db: D1Database, sinceRevision: number, notionSync: NotionSyncStatus): Promise<Response> {
    const cutoff = await currentRevision(db);
    const incremental = sinceRevision > 0;
    const revisionWhere = incremental ? 'revision > ? AND revision <= ?' : 'revision <= ?';
    const bindings = incremental ? [sinceRevision, cutoff] : [cutoff];

    const [entryResult, contentTypeResult, mediaItemResult, tombstoneResult] = await Promise.all([
        db.prepare(`SELECT * FROM entries WHERE ${revisionWhere} ORDER BY timestamp ASC`)
            .bind(...bindings).all<EntryRow>(),
        db.prepare(`SELECT * FROM content_types WHERE ${revisionWhere} ORDER BY sort_order ASC`)
            .bind(...bindings).all<ContentTypeRow>(),
        db.prepare(`SELECT * FROM media_items WHERE ${revisionWhere} ORDER BY created_at DESC`)
            .bind(...bindings).all<MediaItemRow>(),
        db.prepare(`SELECT entity_type, entity_id FROM sync_tombstones WHERE ${revisionWhere}`)
            .bind(...bindings).all<TombstoneRow>(),
    ]);

    const deleted = {
        entries: [] as string[],
        contentTypes: [] as string[],
        mediaItems: [] as string[],
    };
    tombstoneResult.results.forEach(row => {
        if (row.entity_type === 'entry') deleted.entries.push(row.entity_id);
        if (row.entity_type === 'contentType') deleted.contentTypes.push(row.entity_id);
        if (row.entity_type === 'mediaItem') deleted.mediaItems.push(row.entity_id);
    });

    return Response.json({
        entries: entryResult.results.map(entryRowToObject),
        contentTypes: contentTypeResult.results.map(contentTypeRowToObject),
        mediaItems: mediaItemResult.results.map(mediaItemRowToObject),
        deleted,
        revision: cutoff,
        incremental,
        notionSync,
    }, { headers: corsHeaders });
}

// GET /api/data - supports full and incremental fetch
// GET /api/data           → all data (initial load)
// GET /api/data?since=ts  → only changes since that timestamp
export async function onRequestGet(context: CFContext): Promise<Response> {
    const { request, env } = context;

    // Verify authentication
    const auth = await verifyAuth(request, env);
    if (!auth.valid) {
        return unauthorizedResponse(auth.error);
    }

    try {
        const url = new URL(request.url);
        const since = url.searchParams.get('since');
        const revision = url.searchParams.get('revision');
        const db = env.CHRONOLOG_DB;
        const notionSync = await flushNotionSyncJobs(env);

        if (revision !== null) {
            const sinceRevision = Number(revision);
            if (!Number.isSafeInteger(sinceRevision) || sinceRevision < 0) {
                return Response.json({ error: 'Invalid revision' }, { status: 400, headers: corsHeaders });
            }
            return getRevisionData(db, sinceRevision, notionSync);
        }

        let entries: Entry[];
        if (since) {
            // Incremental fetch: only entries updated since the given timestamp
            const sinceTs = parseInt(since, 10);
            const result = await db.prepare(
                'SELECT * FROM entries WHERE updated_at > ? ORDER BY timestamp ASC'
            ).bind(sinceTs).all<EntryRow>();
            entries = result.results.map(entryRowToObject);
        } else {
            // Full fetch: all entries
            const result = await db.prepare(
                'SELECT * FROM entries ORDER BY timestamp ASC'
            ).all<EntryRow>();
            entries = result.results.map(entryRowToObject);
        }

        // Always fetch all content types and media items (small datasets)
        const ctResult = await db.prepare('SELECT * FROM content_types ORDER BY sort_order ASC').all<ContentTypeRow>();
        const contentTypes = ctResult.results.map(contentTypeRowToObject);

        const miResult = await db.prepare('SELECT * FROM media_items ORDER BY created_at DESC').all<MediaItemRow>();
        const mediaItems = miResult.results.map(mediaItemRowToObject);

        const lastModified = await getLastModified(db);

        // Also fetch deleted entry IDs if doing incremental sync
        let deletedIds: string[] = [];
        if (since) {
            const sinceTs = parseInt(since, 10);
            const delResult = await db.prepare(
                'SELECT entry_id FROM deleted_entries WHERE deleted_at > ?'
            ).bind(sinceTs).all<{ entry_id: string }>().catch(() => ({ results: [] as { entry_id: string }[] }));
            deletedIds = delResult.results.map(r => r.entry_id);
        }

        return Response.json({
            entries,
            contentTypes,
            mediaItems,
            lastModified,
            deletedIds,
            incremental: !!since,
            notionSync,
        }, { headers: corsHeaders });
    } catch (error) {
        console.error('Data fetch error:', error);
        return Response.json({ error: 'Failed to fetch data' }, { status: 500, headers: corsHeaders });
    }
}

// Handle OPTIONS preflight request
export async function onRequestOptions(): Promise<Response> {
    return new Response(null, { headers: corsHeaders });
}

interface PutData {
    entries?: Entry[];
    contentTypes?: ContentType[];
    mediaItems?: MediaItem[];
    deletedIds?: string[];
    deletedContentTypeIds?: string[];
    deletedMediaItemIds?: string[];
    mutations?: unknown;
}

function legacyMutations(data: PutData): RevisionMutation[] {
    const mutation = (
        entityType: RevisionMutation['entityType'],
        entityId: string,
        operation: RevisionMutation['operation'],
        value?: Entry | ContentType | MediaItem,
    ): RevisionMutation => ({
        mutationId: `legacy-${crypto.randomUUID()}`,
        entityType,
        entityId,
        operation,
        value,
    });

    return [
        ...(data.entries || []).map(value => mutation('entry', value.id, 'upsert', value)),
        ...(data.contentTypes || []).map(value => mutation('contentType', value.id, 'upsert', value)),
        ...(data.mediaItems || []).map(value => mutation('mediaItem', value.id, 'upsert', value)),
        ...(data.deletedIds || []).map(id => mutation('entry', id, 'delete')),
        ...(data.deletedContentTypeIds || []).map(id => mutation('contentType', id, 'delete')),
        ...(data.deletedMediaItemIds || []).map(id => mutation('mediaItem', id, 'delete')),
    ];
}

// PUT /api/data - Upsert entries, contentTypes, mediaItems into D1
export async function onRequestPut(context: CFContext): Promise<Response> {
    const { request, env } = context;

    // Auth already verified by _middleware.ts for non-public routes

    try {
        const data = await request.json<PutData>();
        const db = env.CHRONOLOG_DB;

        // Validate data structure
        if (!data || typeof data !== 'object') {
            return Response.json({ error: 'Invalid data format' }, { status: 400, headers: corsHeaders });
        }

        if (data.mutations !== undefined) {
            let mutations: RevisionMutation[];
            try {
                mutations = validateRevisionMutations(data.mutations);
            } catch (error) {
                const message = error instanceof Error ? error.message : 'Invalid mutations';
                return Response.json({ error: message }, { status: 400, headers: corsHeaders });
            }
            const result = await applyMutationsWithNotionSync(env, mutations);
            return Response.json({ success: true, ...result }, { headers: corsHeaders });
        }

        // Compatibility path for clients still sending the timestamp-era payload.
        const mutations = legacyMutations(data);
        let revision = await currentRevision(db);
        let lastModified = Date.now();
        let notionSync: NotionSyncStatus = { pending: 0, failed: 0 };
        for (let index = 0; index < mutations.length; index += MAX_MUTATIONS_PER_REQUEST) {
            const result = await applyMutationsWithNotionSync(env, mutations.slice(index, index + MAX_MUTATIONS_PER_REQUEST));
            revision = result.revision;
            lastModified = result.lastModified;
            if (result.notionSync) notionSync = result.notionSync;
        }

        if (mutations.length === 0) notionSync = await flushNotionSyncJobs(env);

        return Response.json({ success: true, lastModified, revision, notionSync }, { headers: corsHeaders });
    } catch (error) {
        console.error('Data save error:', error instanceof Error ? `${error.message}\n${error.stack}` : error);
        const errMsg = error instanceof Error ? error.message : 'Failed to save data';
        return Response.json({ error: errMsg }, { status: 500, headers: corsHeaders });
    }
}
