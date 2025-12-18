// POST /api/comment - AI-powered entry comments
// Uses AI_COMMENT_API_KEY from Cloudflare Secrets (env var)
// Uses KV for non-sensitive config (baseUrl, model, persona)

export async function onRequestPost(context) {
    const { request, env } = context;

    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

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
        const tokenValid = await env.CHRONOLOG_KV.get(`auth_token:${token}`);
        if (!tokenValid) {
            return Response.json({ error: 'Invalid token' }, { status: 401, headers: corsHeaders });
        }

        // Get API Key from Cloudflare Secrets (environment variable)
        const apiKey = env.AI_COMMENT_API_KEY;
        if (!apiKey) {
            return Response.json({
                error: 'AI Comment not configured. Run: wrangler secret put AI_COMMENT_API_KEY'
            }, { status: 400, headers: corsHeaders });
        }

        // Get non-sensitive config from KV (baseUrl, model, persona)
        const configStr = await env.CHRONOLOG_KV.get('ai_comment_config');
        const config = configStr ? JSON.parse(configStr) : {};
        const { baseUrl, model, persona } = config;

        // Get request body
        const { content, todayEntries } = await request.json();
        if (!content) {
            return Response.json({ error: 'Content is required' }, { status: 400, headers: corsHeaders });
        }

        // Build persona/system prompt
        const defaultPersona = `你是一个温暖、有洞察力的日记伙伴。你的任务是：
- 对用户的日记内容给出简短、有共鸣的评论（1-2句话）
- 偶尔提出有启发性的问题
- 保持轻松友好的语气
- 不要说教，不要给建议，除非用户明确要求
- 用中文回复，除非内容是英文`;

        const systemPrompt = persona || defaultPersona;

        // Build context from today's entries
        let dayContext = '';
        if (todayEntries && todayEntries.length > 0) {
            const contextEntries = todayEntries
                .slice(-5)
                .map(e => {
                    const time = new Date(e.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
                    return `[${time}] ${e.content}`;
                })
                .join('\n');

            if (contextEntries) {
                dayContext = `\n\n（背景参考，请忽略这些，只是提供今天的上下文：\n${contextEntries}\n）`;
            }
        }

        const userMessage = `【请只回复这条内容】：
"${content}"

请给出简短评论（1-2句），自然一点，像朋友聊天一样。只针对引号内的内容回复。${dayContext}`;

        // Call AI API
        const normalizedBaseUrl = (baseUrl || 'https://api.openai.com/v1').replace(/\/$/, '');
        const response = await fetch(`${normalizedBaseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: model || 'gpt-4o-mini',
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userMessage }
                ],
                max_tokens: 300,
                temperature: 0.7,
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
        const comment = result.choices?.[0]?.message?.content?.trim();

        return Response.json({ comment }, { headers: corsHeaders });

    } catch (error) {
        return Response.json(
            { error: error.message || 'Comment generation failed' },
            { status: 500, headers: corsHeaders }
        );
    }
}

// Handle OPTIONS preflight
export async function onRequestOptions() {
    return new Response(null, {
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        }
    });
}
