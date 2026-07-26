// POST /api/cleanup - Clean up unreferenced images from R2
// Requires authentication

import { verifyAuth, corsHeaders, unauthorizedResponse } from './_auth.ts';
import type { CFContext } from './types.ts';

// A note that references a freshly uploaded image may still live only in a
// device's IndexedDB (offline, or its sync push hasn't happened yet). Never
// treat recent uploads as garbage.
const RECENT_UPLOAD_GRACE_MS = 7 * 24 * 60 * 60 * 1000;
const R2_DELETE_BATCH_SIZE = 1000;

// Handle OPTIONS preflight request
export async function onRequestOptions(): Promise<Response> {
    return new Response(null, { headers: corsHeaders });
}

export async function onRequestPost(context: CFContext): Promise<Response> {
    const { request, env } = context;

    // Verify authentication
    const auth = await verifyAuth(request, env);
    if (!auth.valid) {
        return unauthorizedResponse(auth.error);
    }

    try {
        const db = env.CHRONOLOG_DB;

        const [notes, sessionStarts, sessionEnds] = await Promise.all([
            db.prepare("SELECT content FROM notes WHERE content LIKE '%/api/image/%'")
                .all<{ content: string }>(),
            db.prepare("SELECT content FROM sessions WHERE content LIKE '%/api/image/%'")
                .all<{ content: string }>(),
            db.prepare("SELECT end_content AS content FROM sessions WHERE end_content LIKE '%/api/image/%'")
                .all<{ content: string }>(),
        ]);

        // Extract all image filenames from entries
        const usedImages = new Set<string>();
        const extractImages = (text: string) => {
            const matches = text.match(/\/api\/image\/([^\s"'`,)\]>]+)/g);
            if (matches) {
                matches.forEach(match => {
                    const filename = match.replace('/api/image/', '');
                    usedImages.add(filename);
                });
            }
        };

        for (const row of [...notes.results, ...sessionStarts.results, ...sessionEnds.results]) {
            if (row.content) extractImages(row.content);
        }

        // Also scan media_items for image references (cover_url, notes, metadata)
        const mediaResult = await db.prepare(
            "SELECT cover_url, notes, metadata FROM media_items"
        ).all<{ cover_url: string | null; notes: string | null; metadata: string | null }>();

        for (const row of mediaResult.results) {
            if (row.cover_url) extractImages(row.cover_url);
            if (row.notes) extractImages(row.notes);
            if (row.metadata) extractImages(row.metadata);
        }

        // List ALL objects in R2 (paginated - R2 returns max 1000 per request)
        const allImages: { key: string; uploaded: Date }[] = [];
        let cursor: string | undefined = undefined;

        do {
            const listed = await env.CHRONOLOG_R2.list({ cursor });
            allImages.push(...listed.objects.map(obj => ({ key: obj.key, uploaded: obj.uploaded })));
            cursor = listed.truncated ? listed.cursor : undefined;
        } while (cursor);

        // Find unreferenced images. Thumbnails ("X.thumb") aren't referenced
        // in content directly — they live and die with their base image.
        const recentCutoff = Date.now() - RECENT_UPLOAD_GRACE_MS;
        let skippedRecent = 0;
        const unreferencedImages: string[] = [];
        for (const image of allImages) {
            const baseKey = image.key.endsWith('.thumb')
                ? image.key.slice(0, -'.thumb'.length)
                : image.key;
            if (usedImages.has(baseKey)) continue;
            if (image.uploaded.getTime() > recentCutoff) {
                skippedRecent++;
                continue;
            }
            unreferencedImages.push(image.key);
        }

        for (let index = 0; index < unreferencedImages.length; index += R2_DELETE_BATCH_SIZE) {
            await env.CHRONOLOG_R2.delete(
                unreferencedImages.slice(index, index + R2_DELETE_BATCH_SIZE),
            );
        }

        return Response.json({
            success: true,
            totalImages: allImages.length,
            usedImages: usedImages.size,
            deletedCount: unreferencedImages.length,
            skippedRecent,
            deletedImages: unreferencedImages
        }, { headers: corsHeaders });
    } catch (error) {
        console.error('Cleanup error:', error);
        return Response.json({ error: 'Failed to cleanup images' }, { status: 500, headers: corsHeaders });
    }
}
