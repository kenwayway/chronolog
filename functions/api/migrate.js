// POST /api/migrate - One-time migration endpoint: KV → D1
// Reads all data from KV and inserts into D1 database
// Should be called once after deploying D1 schema, then this endpoint can be removed

import { verifyAuth, corsHeaders, unauthorizedResponse } from './_auth.js';
import { upsertEntries, upsertContentTypes, upsertMediaItems, setLastModified } from './_db.js';

export async function onRequestPost(context) {
    const { request, env } = context;

    // Verify authentication
    const auth = await verifyAuth(request, env);
    if (!auth.valid) {
        return unauthorizedResponse(auth.error);
    }

    try {
        const db = env.CHRONOLOG_DB;

        // Read existing data from KV
        const kvData = await env.CHRONOLOG_KV.get('user_data', 'json');

        if (!kvData) {
            return Response.json({
                success: true,
                message: 'No KV data found, nothing to migrate',
                entriesCount: 0,
                contentTypesCount: 0,
                mediaItemsCount: 0,
            }, { headers: corsHeaders });
        }

        const entries = kvData.entries || [];
        const contentTypes = kvData.contentTypes || [];
        const mediaItems = kvData.mediaItems || [];

        console.log(`[Migration] Found ${entries.length} entries, ${contentTypes.length} content types, ${mediaItems.length} media items`);

        // One-time migration: convert category=beans/sparks to contentType=beans/sparks
        const migratedEntries = entries.map(entry => {
            const legacyCategory = entry.category;
            if ((legacyCategory === 'beans' || legacyCategory === 'sparks') && !entry.contentType) {
                return {
                    ...entry,
                    contentType: legacyCategory,
                    category: undefined,
                };
            }
            return entry;
        });

        // Insert into D1
        await upsertEntries(db, migratedEntries);
        await upsertContentTypes(db, contentTypes);
        await upsertMediaItems(db, mediaItems);

        // Set last modified
        const lastModified = kvData.lastModified || Date.now();
        await setLastModified(db, lastModified);

        console.log('[Migration] Complete!');

        return Response.json({
            success: true,
            message: 'Migration complete',
            entriesCount: migratedEntries.length,
            contentTypesCount: contentTypes.length,
            mediaItemsCount: mediaItems.length,
            lastModified,
        }, { headers: corsHeaders });
    } catch (error) {
        console.error('[Migration] Error:', error);
        return Response.json(
            { error: error.message || 'Migration failed' },
            { status: 500, headers: corsHeaders }
        );
    }
}

// Handle OPTIONS preflight
export async function onRequestOptions() {
    return new Response(null, { headers: corsHeaders });
}
