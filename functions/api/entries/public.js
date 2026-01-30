// GET /api/entries/public?token=xxx - Public API endpoint for AI access to entries
// Requires PUBLIC_API_TOKEN environment variable to be set in Cloudflare

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

        // Fetch user data from KV
        const data = await env.CHRONOLOG_KV.get('user_data', 'json');

        if (!data) {
            return Response.json(
                { entries: [], lastModified: null },
                { headers: corsHeaders }
            );
        }

        // Optional: filter entries by date range
        const startDate = url.searchParams.get('start');
        const endDate = url.searchParams.get('end');

        let entries = data.entries || [];

        if (startDate) {
            const start = new Date(startDate).getTime();
            entries = entries.filter(e => e.timestamp >= start);
        }

        if (endDate) {
            const end = new Date(endDate).getTime();
            entries = entries.filter(e => e.timestamp <= end);
        }

        // Sort by timestamp descending (most recent first)
        entries.sort((a, b) => b.timestamp - a.timestamp);

        // Optional: limit number of entries
        const limit = parseInt(url.searchParams.get('limit') || '100', 10);
        entries = entries.slice(0, Math.min(limit, 1000));

        return Response.json({
            entries,
            mediaItems: data.mediaItems || [],
            contentTypes: data.contentTypes || [],
            lastModified: data.lastModified,
            count: entries.length,
        }, { headers: corsHeaders });

    } catch (error) {
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
