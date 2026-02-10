// GET /api/data - Fetch user data from D1
// PUT /api/data - Save user data to D1 (incremental upsert)

import { verifyAuth, corsHeaders, unauthorizedResponse } from './_auth.ts';
import {
    entryRowToObject,
    contentTypeRowToObject,
    mediaItemRowToObject,
    upsertEntries,
    upsertContentTypes,
    upsertMediaItems,
    getLastModified,
    setLastModified,
} from './_db.ts';
import type { CFContext, Env, Entry, ContentType, MediaItem, EntryRow, ContentTypeRow, MediaItemRow } from './types.ts';

// GET /api/data - supports full and incremental fetch
// GET /api/data           → all data (initial load)
// GET /api/data?since=ts  → only changes since that timestamp
export async function onRequestGet(context: CFContext): Promise<Response> {
    const { request, env } = context;

    try {
        const url = new URL(request.url);
        const since = url.searchParams.get('since');
        const db = env.CHRONOLOG_DB;

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

// Send webhook notification to OpenClaw for new entries
async function notifyOpenClaw(entry: Entry, env: Env): Promise<void> {
    const webhookSecret = env.OPENCLAW_WEBHOOK_SECRET || 'chronolog-webhook-secret';
    const response = await fetch('https://claw.233446.xyz/hooks/wake', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${webhookSecret}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            entryId: entry.id,
            text: `宝宝刚刚在她的chronolog更新了，内容是: ${entry.content}，你可以自己决定是否根据这个更新内容回复她`,
            mode: 'now'
        })
    });
    console.log('OpenClaw webhook response:', response.status);
}

interface PutData {
    entries?: Entry[];
    contentTypes?: ContentType[];
    mediaItems?: MediaItem[];
    deletedIds?: string[];
    deletedContentTypeIds?: string[];
    deletedMediaItemIds?: string[];
}

// PUT /api/data - Upsert entries, contentTypes, mediaItems into D1
export async function onRequestPut(context: CFContext): Promise<Response> {
    const { request, env, waitUntil } = context;

    // Verify authentication
    const auth = await verifyAuth(request, env);
    if (!auth.valid) {
        return unauthorizedResponse(auth.error);
    }

    try {
        const data = await request.json<PutData>();
        const db = env.CHRONOLOG_DB;

        // Validate data structure
        if (!data || typeof data !== 'object') {
            return Response.json({ error: 'Invalid data format' }, { status: 400, headers: corsHeaders });
        }

        // Detect new entries (for OpenClaw webhook)
        const incomingEntries = data.entries || [];
        let existingIds = new Set<string>();
        if (incomingEntries.length > 0) {
            // Get existing entry IDs in a single query
            const ids = incomingEntries.map(e => e.id);
            const placeholders = ids.map(() => '?').join(',');
            const existingResult = await db.prepare(
                `SELECT id FROM entries WHERE id IN (${placeholders})`
            ).bind(...ids).all<{ id: string }>();
            existingIds = new Set(existingResult.results.map(r => r.id));
        }

        const newEntries = incomingEntries.filter(e => !existingIds.has(e.id));

        // Upsert all data
        await upsertEntries(db, incomingEntries);
        await upsertContentTypes(db, data.contentTypes || []);
        await upsertMediaItems(db, data.mediaItems || []);

        // Handle deleted entries
        if (data.deletedIds && data.deletedIds.length > 0) {
            const delStmt = db.prepare('DELETE FROM entries WHERE id = ?');
            const trackStmt = db.prepare(
                'INSERT OR REPLACE INTO deleted_entries (entry_id, deleted_at) VALUES (?, ?)'
            );
            const now = Date.now();
            const delBatches = data.deletedIds.flatMap(id => [
                delStmt.bind(id),
                trackStmt.bind(id, now),
            ]);
            for (let i = 0; i < delBatches.length; i += 100) {
                await db.batch(delBatches.slice(i, i + 100));
            }
        }

        // Handle deleted content types
        if (data.deletedContentTypeIds && data.deletedContentTypeIds.length > 0) {
            const stmt = db.prepare('DELETE FROM content_types WHERE id = ? AND built_in = 0');
            const batches = data.deletedContentTypeIds.map(id => stmt.bind(id));
            await db.batch(batches);
        }

        // Handle deleted media items
        if (data.deletedMediaItemIds && data.deletedMediaItemIds.length > 0) {
            const stmt = db.prepare('DELETE FROM media_items WHERE id = ?');
            const batches = data.deletedMediaItemIds.map(id => stmt.bind(id));
            await db.batch(batches);
        }

        // Update last modified timestamp
        const now = Date.now();
        await setLastModified(db, now);

        // Send webhook notifications for new entries
        for (const entry of newEntries) {
            if (entry.content && entry.content.trim()) {
                waitUntil(notifyOpenClaw(entry, env));
            }
        }

        return Response.json({
            success: true,
            lastModified: now,
        }, { headers: corsHeaders });
    } catch (error) {
        console.error('Data save error:', error);
        return Response.json({ error: 'Failed to save data' }, { status: 500, headers: corsHeaders });
    }
}
