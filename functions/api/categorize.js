// POST /api/categorize - AI-powered entry categorization and content type detection
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
    // Verify auth token (multi-device: token stored as auth_token:{token})
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return Response.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });
    }
    const token = authHeader.slice(7);
    const tokenValid = await env.CHRONOLOG_KV.get(`auth_token:${token}`);
    if (!tokenValid) {
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
    const { content, categories, contentTypes } = await request.json();
    if (!content || !categories || !Array.isArray(categories)) {
      return Response.json({ error: 'Invalid request body' }, { status: 400, headers: corsHeaders });
    }

    // Build prompt - now detects both category AND content type
    const categoryList = categories.map(c => `${c.id}: ${c.label}`).join(', ');

    // Content types for detection (built-in: note, task, expense)
    const contentTypeList = contentTypes
      ? contentTypes.map(ct => `${ct.id}: ${ct.name}`).join(', ')
      : 'note: regular note, task: todo item, expense: money spent';

    const prompt = `You are an entry analyzer. Analyze this log entry and return a JSON object.

Categories (life areas): ${categoryList}
Content types: ${contentTypeList}

Entry: "${content}"

Return ONLY a valid JSON object with these fields:
- category: the category ID that best matches (or null if unsure)
- contentType: the content type ID (default to "note" if unsure)
- fieldValues: Extract relevant fields based on content type

Content type detection rules:
- If entry contains a URL (http/https), it's likely a "bookmark"
- If entry mentions spending/buying/paying money or has currency symbols, it's "expense"
- If entry is a todo/reminder/action item (买/记得/要/todo), it's "task"
- Otherwise, it's "note"

FieldValues by content type:
- expense: {amount: number, currency: "USD"|"CNY"|"EUR"|"GBP"|"JPY", category: string, subcategory: string}
- task: {done: false}
- bookmark: {url: "extracted URL", title: "title from content", type: "Article"|"Video"|"Tool"|"Paper", status: "Inbox"}
- note: null

Currency hints: $ = USD, ¥/元/块/刀 = CNY, € = EUR, £ = GBP, 円 = JPY
Expense categories: Food, Transport, Entertainment, Shopping, Health, Bills, Other

Example responses:
{"category":"hustle","contentType":"note","fieldValues":null}
{"category":"beans","contentType":"expense","fieldValues":{"amount":35,"currency":"CNY","category":"Food","subcategory":"Cafe"}}
{"category":"craft","contentType":"task","fieldValues":{"done":false}}
{"category":"kernel","contentType":"bookmark","fieldValues":{"url":"https://example.com/article","title":"Great Article","type":"Article","status":"Inbox"}}`;

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
        max_tokens: 100,
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
    const rawContent = result.choices?.[0]?.message?.content?.trim();

    // Parse JSON response
    let parsed = { category: null, contentType: 'note', fieldValues: null };
    try {
      // Extract JSON from response (handle markdown code blocks)
      const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      }
    } catch (e) {
      console.error('Failed to parse AI response:', rawContent);
    }

    // Validate category ID
    const validCategory = categories.find(c => c.id === parsed.category);

    return Response.json({
      category: validCategory ? parsed.category : null,
      contentType: parsed.contentType || 'note',
      fieldValues: parsed.fieldValues || null,
      raw: rawContent,
    }, { headers: corsHeaders });

  } catch (error) {
    return Response.json(
      { error: error.message || 'Categorization failed' },
      { status: 500, headers: corsHeaders }
    );
  }
}
