// POST /api/entries/:id/comment - External comment write endpoint
// Used by OpenClaw to write comments back to entries

import { corsHeaders } from '../../_auth.ts';
import type { Env, AuthResult, CFContext } from '../../types.ts';

// Verify webhook secret for OpenClaw
function verifyWebhookAuth(request: Request, env: Env): AuthResult {
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

export async function onRequestPost(context: CFContext<'id'>): Promise<Response> {
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
        const { comment } = await request.json<{ comment: string }>();

        if (!comment || typeof comment !== 'string') {
            return Response.json(
                { error: 'Comment is required and must be a string' },
                { status: 400, headers: corsHeaders }
            );
        }

        const db = env.CHRONOLOG_DB;
        const now = Date.now();

        // Check entry exists
        const existing = await db.prepare('SELECT id FROM entries WHERE id = ?').bind(entryId).first<{ id: string }>();
        if (!existing) {
            return Response.json(
                { error: 'Entry not found' },
                { status: 404, headers: corsHeaders }
            );
        }

        // Update the entry with the comment (single row update)
        await db.prepare(
            'UPDATE entries SET ai_comment = ?, updated_at = ? WHERE id = ?'
        ).bind(comment, now, entryId).run();

        // Update last modified
        await db.prepare(
            "INSERT OR REPLACE INTO sync_meta (key, value) VALUES ('last_modified', ?)"
        ).bind(String(now)).run();

        return Response.json({
            success: true,
            entryId,
            comment,
            lastModified: now
        }, { headers: corsHeaders });

    } catch (error) {
        console.error('Comment write error:', error);
        const message = error instanceof Error ? error.message : 'Failed to write comment';
        return Response.json(
            { error: message },
            { status: 500, headers: corsHeaders }
        );
    }
}

// Handle OPTIONS preflight
export async function onRequestOptions(): Promise<Response> {
    return new Response(null, { headers: corsHeaders });
}
