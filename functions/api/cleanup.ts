// POST /api/cleanup - Clean up unreferenced images from R2
// Requires authentication

import { verifyAuth, corsHeaders, unauthorizedResponse } from './_auth.ts';
import type { CFContext } from './types.ts';

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

        // Query entries that contain image references directly from D1
        const result = await db.prepare(
            "SELECT content FROM entries WHERE content LIKE '%/api/image/%'"
        ).all<{ content: string }>();

        // Extract all image filenames from entries
        const usedImages = new Set<string>();
        for (const row of result.results) {
            if (row.content) {
                const matches = row.content.match(/\/api\/image\/([^\s\n]+)/g);
                if (matches) {
                    matches.forEach(match => {
                        const filename = match.replace('/api/image/', '');
                        usedImages.add(filename);
                    });
                }
            }
        }

        // List ALL objects in R2 (paginated - R2 returns max 1000 per request)
        const allImages: string[] = [];
        let cursor: string | undefined = undefined;

        do {
            const listed = await env.CHRONOLOG_R2.list({ cursor });
            allImages.push(...listed.objects.map(obj => obj.key));
            cursor = listed.truncated ? listed.cursor : undefined;
        } while (cursor);

        // Find unreferenced images
        const unreferencedImages = allImages.filter(img => !usedImages.has(img));

        // Delete unreferenced images
        let deletedCount = 0;
        for (const key of unreferencedImages) {
            await env.CHRONOLOG_R2.delete(key);
            deletedCount++;
        }

        return Response.json({
            success: true,
            totalImages: allImages.length,
            usedImages: usedImages.size,
            deletedCount,
            deletedImages: unreferencedImages
        }, { headers: corsHeaders });
    } catch (error) {
        console.error('Cleanup error:', error);
        return Response.json({ error: 'Failed to cleanup images' }, { status: 500, headers: corsHeaders });
    }
}
