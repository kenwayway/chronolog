// GET /api/entries/public?token=xxx - Public API endpoint for AI access to entries
// Requires PUBLIC_API_TOKEN environment variable to be set in Cloudflare

import { entryRowToObject, contentTypeRowToObject, mediaItemRowToObject, getLastModified } from '../_db.js';

export async function onRequestGet(context) {
    const { request, env } = context;

    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json',
    };

    try {
        // Get token from query parameter
        const url = new URL(request.url);
        const token = url.searchParams.get('token');

        // Validate token against environment variable
        if (!env.PUBLIC_API_TOKEN) {
            return Response.json(
                { error: 'Public API not configured' },
                { status: 503, headers: corsHeaders }
            );
        }

        if (!token || token !== env.PUBLIC_API_TOKEN) {
            return Response.json(
                { error: 'Invalid or missing token' },
                { status: 401, headers: corsHeaders }
            );
        }

        const db = env.CHRONOLOG_DB;

        // Build query with optional date range filters
        const startDate = url.searchParams.get('start');
        const endDate = url.searchParams.get('end');
        const limit = Math.min(parseInt(url.searchParams.get('limit') || '100', 10), 1000);

        let query = 'SELECT * FROM entries WHERE 1=1';
        const bindings = [];

        if (startDate) {
            const start = new Date(startDate).getTime();
            query += ' AND timestamp >= ?';
            bindings.push(start);
        }

        if (endDate) {
            const end = new Date(endDate).getTime();
            query += ' AND timestamp <= ?';
            bindings.push(end);
        }

        query += ' ORDER BY timestamp DESC LIMIT ?';
        bindings.push(limit);

        const stmt = db.prepare(query);
        const result = await (bindings.length > 0 ? stmt.bind(...bindings) : stmt).all();
        const entries = result.results.map(entryRowToObject);

        // Fetch content types and media items
        const ctResult = await db.prepare('SELECT * FROM content_types ORDER BY sort_order ASC').all();
        const contentTypes = ctResult.results.map(contentTypeRowToObject);

        const miResult = await db.prepare('SELECT * FROM media_items ORDER BY created_at DESC').all();
        const mediaItems = miResult.results.map(mediaItemRowToObject);

        const lastModified = await getLastModified(db);

        return Response.json({
            entries,
            mediaItems,
            contentTypes,
            lastModified,
            count: entries.length,
        }, { headers: corsHeaders });

    } catch (error) {
        console.error('Public API error:', error);
        return Response.json(
            { error: 'Failed to fetch entries' },
            { status: 500, headers: corsHeaders }
        );
    }
}

// Handle OPTIONS preflight request
export async function onRequestOptions() {
    return new Response(null, {
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Max-Age': '86400',
        },
    });
}
