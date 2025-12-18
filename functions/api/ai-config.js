// GET/PUT /api/ai-config - AI Comment configuration
// API Key is stored as Cloudflare Secret (env.AI_COMMENT_API_KEY)
// Non-sensitive config (baseUrl, model, persona) stored in KV

export async function onRequestGet(context) {
    const { request, env } = context;

    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    try {
        // Verify auth token
        const authHeader = request.headers.get('Authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return Response.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });
        }
        const token = authHeader.slice(7);
        const tokenValid = await env.CHRONOLOG_KV.get(`auth_token:${token}`);
        if (!tokenValid) {
            return Response.json({ error: 'Invalid token' }, { status: 401, headers: corsHeaders });
        }

        // Check if API Key is configured (from env/secrets)
        const hasApiKey = !!env.AI_COMMENT_API_KEY;

        // Get non-sensitive config from KV
        const configStr = await env.CHRONOLOG_KV.get('ai_comment_config');
        const config = configStr ? JSON.parse(configStr) : {};

        return Response.json({
            hasApiKey,
            baseUrl: config.baseUrl || 'https://api.openai.com/v1',
            model: config.model || 'gpt-4o-mini',
            persona: config.persona || ''
        }, { headers: corsHeaders });

    } catch (error) {
        return Response.json(
            { error: error.message || 'Failed to get config' },
            { status: 500, headers: corsHeaders }
        );
    }
}

export async function onRequestPut(context) {
    const { request, env } = context;

    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    try {
        // Verify auth token
        const authHeader = request.headers.get('Authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return Response.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });
        }
        const token = authHeader.slice(7);
        const tokenValid = await env.CHRONOLOG_KV.get(`auth_token:${token}`);
        if (!tokenValid) {
            return Response.json({ error: 'Invalid token' }, { status: 401, headers: corsHeaders });
        }

        const body = await request.json();

        // Get existing config
        const existingStr = await env.CHRONOLOG_KV.get('ai_comment_config');
        const existing = existingStr ? JSON.parse(existingStr) : {};

        // Update non-sensitive config only (API Key is set via wrangler secret)
        const config = {
            baseUrl: body.baseUrl !== undefined ? body.baseUrl : existing.baseUrl,
            model: body.model !== undefined ? body.model : existing.model,
            persona: body.persona !== undefined ? body.persona : existing.persona,
        };

        await env.CHRONOLOG_KV.put('ai_comment_config', JSON.stringify(config));

        return Response.json({
            success: true,
            hasApiKey: !!env.AI_COMMENT_API_KEY,
            baseUrl: config.baseUrl || 'https://api.openai.com/v1',
            model: config.model || 'gpt-4o-mini',
            persona: config.persona || ''
        }, { headers: corsHeaders });

    } catch (error) {
        return Response.json(
            { error: error.message || 'Failed to save config' },
            { status: 500, headers: corsHeaders }
        );
    }
}

// Handle OPTIONS preflight
export async function onRequestOptions() {
    return new Response(null, {
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        }
    });
}
