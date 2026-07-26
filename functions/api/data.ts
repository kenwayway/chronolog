import { verifyAuth, corsHeaders, unauthorizedResponse } from './_auth.ts';
import {
    contentTypeRowToObject,
    mediaItemRowToObject,
    noteRowToObject,
    sessionRowToObject,
} from './_db.ts';
import {
    collectSyncGarbage,
    currentRevision,
    pageEndRevision,
    validateRevisionMutations,
} from './_revisionSync.ts';
import {
    applyMutationsWithNotionSync,
    flushNotionSyncJobs,
    getNotionSyncStatus,
    type NotionSyncStatus,
} from './_notionSync.ts';
import type {
    CFContext,
    ContentTypeRow,
    MediaItemRow,
    NoteRow,
    SessionRow,
} from './types.ts';

interface TombstoneRow {
    entity_type: 'note' | 'session' | 'contentType' | 'mediaItem';
    entity_id: string;
}

const EMPTY_TOMBSTONES = { results: [] as TombstoneRow[] };

async function getRevisionData(
    db: D1Database,
    sinceRevision: number,
    notionSync: NotionSyncStatus,
    paged: boolean,
): Promise<Response> {
    const cutoff = await currentRevision(db);
    const incremental = sinceRevision > 0;

    // A paged pull closes the response at the revision that keeps it under
    // PULL_PAGE_SIZE rows; the client keeps requesting from the returned
    // revision until hasMore is false.
    let upper = cutoff;
    let hasMore = false;
    if (paged) {
        const pageEnd = await pageEndRevision(db, sinceRevision);
        if (pageEnd !== null && pageEnd < cutoff) {
            upper = pageEnd;
            hasMore = true;
        }
    }

    const revisionWhere = incremental ? 'revision > ?1 AND revision <= ?2' : 'revision <= ?1';
    const bindings = incremental ? [sinceRevision, upper] : [upper];

    const [notes, sessions, contentTypes, mediaItems, tombstones] = await Promise.all([
        db.prepare(`SELECT * FROM notes WHERE ${revisionWhere} ORDER BY timestamp ASC`)
            .bind(...bindings).all<NoteRow>(),
        db.prepare(`SELECT * FROM sessions WHERE ${revisionWhere} ORDER BY start_at ASC`)
            .bind(...bindings).all<SessionRow>(),
        db.prepare(`SELECT * FROM content_types WHERE ${revisionWhere} ORDER BY sort_order ASC`)
            .bind(...bindings).all<ContentTypeRow>(),
        db.prepare(`SELECT * FROM media_items WHERE ${revisionWhere} ORDER BY created_at DESC`)
            .bind(...bindings).all<MediaItemRow>(),
        // A full response is authoritative by absence: entities missing from
        // it disappear on merge (and any dirty stragglers are rejected on
        // push by their tombstones). Skipping the ever-growing tombstone list
        // here keeps full pulls bounded by live data, not deletion history.
        incremental
            ? db.prepare(`SELECT entity_type, entity_id FROM sync_tombstones WHERE ${revisionWhere}`)
                .bind(...bindings).all<TombstoneRow>()
            : Promise.resolve(EMPTY_TOMBSTONES),
    ]);

    const deleted = {
        notes: [] as string[],
        sessions: [] as string[],
        contentTypes: [] as string[],
        mediaItems: [] as string[],
    };
    tombstones.results.forEach(row => {
        if (row.entity_type === 'note') deleted.notes.push(row.entity_id);
        if (row.entity_type === 'session') deleted.sessions.push(row.entity_id);
        if (row.entity_type === 'contentType') deleted.contentTypes.push(row.entity_id);
        if (row.entity_type === 'mediaItem') deleted.mediaItems.push(row.entity_id);
    });

    return Response.json({
        notes: notes.results.map(noteRowToObject),
        sessions: sessions.results.map(sessionRowToObject),
        contentTypes: contentTypes.results.map(contentTypeRowToObject),
        mediaItems: mediaItems.results.map(mediaItemRowToObject),
        deleted,
        revision: upper,
        incremental,
        hasMore,
        notionSync,
    }, { headers: corsHeaders });
}

export async function onRequestGet(context: CFContext): Promise<Response> {
    const { request, env } = context;
    const auth = await verifyAuth(request, env);
    if (!auth.valid) return unauthorizedResponse(auth.error);

    try {
        const url = new URL(request.url);
        const revision = Number(url.searchParams.get('revision') ?? 0);
        if (!Number.isSafeInteger(revision) || revision < 0) {
            return Response.json({ error: 'Invalid revision' }, { status: 400, headers: corsHeaders });
        }
        // Third-party Notion writes and bookkeeping GC run after the
        // response; a pull must never wait on the Notion API.
        context.waitUntil(
            flushNotionSyncJobs(env)
                .then(() => collectSyncGarbage(env.CHRONOLOG_DB))
                .catch(error => console.error('Deferred pull maintenance failed:', error)),
        );
        const notionSync = await getNotionSyncStatus(env.CHRONOLOG_DB);
        return getRevisionData(env.CHRONOLOG_DB, revision, notionSync, url.searchParams.get('paged') === '1');
    } catch (error) {
        console.error('Data fetch error:', error);
        return Response.json({ error: 'Failed to fetch data' }, { status: 500, headers: corsHeaders });
    }
}

export async function onRequestOptions(): Promise<Response> {
    return new Response(null, { headers: corsHeaders });
}

export async function onRequestPut(context: CFContext): Promise<Response> {
    try {
        const data = await context.request.json<{ mutations?: unknown }>();
        if (!data || typeof data !== 'object' || data.mutations === undefined) {
            return Response.json(
                { error: 'A revision mutation batch is required' },
                { status: 400, headers: corsHeaders },
            );
        }

        let validated;
        try {
            validated = validateRevisionMutations(data.mutations);
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Invalid mutations';
            return Response.json({ error: message }, { status: 400, headers: corsHeaders });
        }

        const result = await applyMutationsWithNotionSync(
            context.env,
            validated.accepted,
            promise => context.waitUntil(promise),
        );
        const rejectedMutations = [...validated.rejected, ...result.rejectedMutations];
        return Response.json({
            success: true,
            ...result,
            rejectedMutations,
            // Rejected mutations are still acknowledged so clients drop them
            // from their outbox instead of retrying a batch that can never
            // succeed. Clients that understand rejectedMutations handle the
            // rejected IDs specially before acknowledging.
            appliedMutationIds: [
                ...result.appliedMutationIds,
                ...rejectedMutations.map(mutation => mutation.mutationId),
            ],
        }, { headers: corsHeaders });
    } catch (error) {
        console.error('Data save error:', error);
        return Response.json(
            { error: error instanceof Error ? error.message : 'Failed to save data' },
            { status: 500, headers: corsHeaders },
        );
    }
}
