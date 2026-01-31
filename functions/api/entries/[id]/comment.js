// POST /api/entries/:id/comment - External comment write endpoint
// Used by OpenClaw to write comments back to entries

import { corsHeaders } from '../../_auth.js';

// Verify webhook secret for OpenClaw
function verifyWebhookAuth(request, env) {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return { valid: false, error: 'Missing or invalid Authorization header' };
    }

    const token = authHeader.slice(7);
    const expectedSecret = env.OPENCLAW_WEBHOOK_SECRET || 'chronolog-webhook-secret';

    if (token !== expectedSecret) {
        return { valid: false, error: 'Invalid webhook secret' };
    }

    return { valid: true };
}

export async function onRequestPost(context) {
    const { request, env, params } = context;
    const entryId = params.id;

    // Verify webhook authentication
    const auth = verifyWebhookAuth(request, env);
    if (!auth.valid) {
        return Response.json(
            { error: auth.error },
            { status: 401, headers: corsHeaders }
        );
    }

    try {
        const { comment } = await request.json();

        if (!comment || typeof comment !== 'string') {
            return Response.json(
                { error: 'Comment is required and must be a string' },
                { status: 400, headers: corsHeaders }
            );
        }

        // Get existing data
        const data = await env.CHRONOLOG_KV.get('user_data', 'json');
        if (!data || !data.entries) {
            return Response.json(
                { error: 'No data found' },
                { status: 404, headers: corsHeaders }
            );
        }

        // Find the entry
        const entryIndex = data.entries.findIndex(e => e.id === entryId);
        if (entryIndex === -1) {
            return Response.json(
                { error: 'Entry not found' },
                { status: 404, headers: corsHeaders }
            );
        }

        // Update the entry with the comment
        data.entries[entryIndex].aiComment = comment;
        data.lastModified = Date.now();

        // Save back to KV
        await env.CHRONOLOG_KV.put('user_data', JSON.stringify(data));

        return Response.json({
            success: true,
            entryId,
            comment,
            lastModified: data.lastModified
        }, { headers: corsHeaders });

    } catch (error) {
        console.error('Comment write error:', error);
        return Response.json(
            { error: error.message || 'Failed to write comment' },
            { status: 500, headers: corsHeaders }
        );
    }
}

// Handle OPTIONS preflight
export async function onRequestOptions() {
    return new Response(null, { headers: corsHeaders });
}
