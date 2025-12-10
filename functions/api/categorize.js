// POST /api/categorize - AI-powered entry categorization
// Uses AI config from Cloudflare environment variables

export async function onRequestPost(context) {
    const { request, env } = context;

    // CORS headers
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    // Handle preflight
    if (request.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        // Verify auth token
        const authHeader = request.headers.get('Authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return Response.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });
        }
        const token = authHeader.slice(7);
        const storedToken = await env.CHRONOLOG_KV.get('auth_token');
        if (token !== storedToken) {
            return Response.json({ error: 'Invalid token' }, { status: 401, headers: corsHeaders });
        }

        // Get AI config from environment
        const aiApiKey = env.AI_API_KEY;
        const aiBaseUrl = env.AI_BASE_URL || 'https://api.openai.com/v1';
        const aiModel = env.AI_MODEL || 'gpt-4o-mini';

        if (!aiApiKey) {
            return Response.json({ error: 'AI not configured' }, { status: 500, headers: corsHeaders });
        }

        // Get request body
        const { content, categories } = await request.json();
        if (!content || !categories || !Array.isArray(categories)) {
            return Response.json({ error: 'Invalid request body' }, { status: 400, headers: corsHeaders });
        }

        // Build prompt
        const categoryList = categories.map(c => `${c.id}: ${c.label}`).join(', ');
        const prompt = `You are a categorization assistant. Given a log entry, return ONLY the category ID that best matches.

Categories: ${categoryList}

Entry: "${content}"

Return ONLY the category ID (one word, lowercase). If unsure, return "none".`;

        // Call AI API
        const response = await fetch(`${aiBaseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${aiApiKey}`,
            },
            body: JSON.stringify({
                model: aiModel,
                messages: [{ role: 'user', content: prompt }],
                max_tokens: 20,
                temperature: 0.1,
            }),
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            return Response.json(
                { error: error.error?.message || `AI API error: ${response.status}` },
                { status: 502, headers: corsHeaders }
            );
        }

        const result = await response.json();
        const categoryId = result.choices?.[0]?.message?.content?.trim().toLowerCase();

        // Validate category ID
        const validCategory = categories.find(c => c.id === categoryId);

        return Response.json({
            category: validCategory ? categoryId : null,
            raw: categoryId,
        }, { headers: corsHeaders });

    } catch (error) {
        return Response.json(
            { error: error.message || 'Categorization failed' },
            { status: 500, headers: corsHeaders }
        );
    }
}
