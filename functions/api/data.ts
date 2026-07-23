import { verifyAuth, corsHeaders, unauthorizedResponse } from './_auth.ts';
import {
    contentTypeRowToObject,
    mediaItemRowToObject,
    noteRowToObject,
    sessionRowToObject,
} from './_db.ts';
import {
    currentRevision,
    validateRevisionMutations,
} from './_revisionSync.ts';
import { applyMutationsWithNotionSync, flushNotionSyncJobs, type NotionSyncStatus } from './_notionSync.ts';
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

async function getRevisionData(
    db: D1Database,
    sinceRevision: number,
    notionSync: NotionSyncStatus,
): Promise<Response> {
    const cutoff = await currentRevision(db);
    const incremental = sinceRevision > 0;
    const revisionWhere = incremental ? 'revision > ? AND revision <= ?' : 'revision <= ?';
    const bindings = incremental ? [sinceRevision, cutoff] : [cutoff];

    const [notes, sessions, contentTypes, mediaItems, tombstones] = await Promise.all([
        db.prepare(`SELECT * FROM notes WHERE ${revisionWhere} ORDER BY timestamp ASC`)
            .bind(...bindings).all<NoteRow>(),
        db.prepare(`SELECT * FROM sessions WHERE ${revisionWhere} ORDER BY start_at ASC`)
            .bind(...bindings).all<SessionRow>(),
        db.prepare(`SELECT * FROM content_types WHERE ${revisionWhere} ORDER BY sort_order ASC`)
            .bind(...bindings).all<ContentTypeRow>(),
        db.prepare(`SELECT * FROM media_items WHERE ${revisionWhere} ORDER BY created_at DESC`)
            .bind(...bindings).all<MediaItemRow>(),
        db.prepare(`SELECT entity_type, entity_id FROM sync_tombstones WHERE ${revisionWhere}`)
            .bind(...bindings).all<TombstoneRow>(),
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
        revision: cutoff,
        incremental,
        notionSync,
    }, { headers: corsHeaders });
}

export async function onRequestGet(context: CFContext): Promise<Response> {
    const { request, env } = context;
    const auth = await verifyAuth(request, env);
    if (!auth.valid) return unauthorizedResponse(auth.error);

    try {
        const revision = Number(new URL(request.url).searchParams.get('revision') ?? 0);
        if (!Number.isSafeInteger(revision) || revision < 0) {
            return Response.json({ error: 'Invalid revision' }, { status: 400, headers: corsHeaders });
        }
        const notionSync = await flushNotionSyncJobs(env);
        return getRevisionData(env.CHRONOLOG_DB, revision, notionSync);
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

        let mutations;
        try {
            mutations = validateRevisionMutations(data.mutations);
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Invalid mutations';
            return Response.json({ error: message }, { status: 400, headers: corsHeaders });
        }

        const result = await applyMutationsWithNotionSync(context.env, mutations);
        return Response.json({ success: true, ...result }, { headers: corsHeaders });
    } catch (error) {
        console.error('Data save error:', error);
        return Response.json(
            { error: error instanceof Error ? error.message : 'Failed to save data' },
            { status: 500, headers: corsHeaders },
        );
    }
}
