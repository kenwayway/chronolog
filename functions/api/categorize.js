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
    const categoryList = categories.map(c => `${c.id} (${c.label}): ${c.description || c.label}`).join('\\n');

    // Content types for detection (built-in: note, task, expense)
    const contentTypeList = contentTypes
      ? contentTypes.map(ct => `${ct.id}: ${ct.name}`).join(', ')
      : 'note: regular note, task: todo item, expense: money spent';

    const prompt = `You are an entry analyzer. Analyze this log entry and return a JSON object.

Categories (life areas):
${categoryList}

Content types: ${contentTypeList}

Entry: "${content}"

Return ONLY a valid JSON object with these fields:
- category: the category ID that best matches (or null if unsure)
- contentType: the content type ID (default to "note" if unsure)
- fieldValues: Extract relevant fields based on content type

Content type detection rules:
- If entry contains a URL (http/https) that is NOT an image (not ending in .jpg, .jpeg, .png, .gif, .webp, .svg, .ico), it's likely a "bookmark"
- If entry mentions spending/buying/paying money or has currency symbols, it's "expense"
- If entry is a todo/reminder/action item (买/记得/要/todo), it's "task"
- If entry expresses feelings, emotions, or mood (feeling/心情/feel/累/开心/sad/happy/tired/stressed/anxious), it's "mood"
- Otherwise, it's "note"

FieldValues by content type:
- expense: {amount: number, currency: "USD"|"CNY"|"EUR"|"GBP"|"JPY", category: string, subcategory: string}
- task: {done: false}
- bookmark: {url: "extracted URL", title: "title from content", type: "Article"|"Video"|"Tool"|"Paper", status: "Inbox"}
- mood: {feeling: "Happy"|"Calm"|"Tired"|"Anxious"|"Sad"|"Angry", energy: 1-5, trigger: "Work"|"Health"|"Social"|"Money"|"Family"|"Sleep"|"Weather"|"Other"}
- note: null

Currency hints: $ = USD, ¥/元/块/刀 = CNY, € = EUR, £ = GBP, 円 = JPY
Expense categories: Food, Transport, Entertainment, Shopping, Health, Bills, Other
Mood hints: 开心/excited/joyful = Happy, 平静/relaxed = Calm, 累/疲惫/sleepy = Tired, 焦虑/stressed/nervous = Anxious, 难过/down/upset = Sad, 生气/frustrated = Angry
Trigger hints: 工作/office/deadline/meeting = Work, 身体/sick/headache = Health, 朋友/party/social = Social, 钱/broke/expensive = Money, 家/parents = Family, 睡眠/insomnia/晚睡 = Sleep, rain/hot/cold = Weather
Energy hints: very tired/exhausted = 1, tired = 2, normal/okay = 3, energetic = 4, very energetic = 5

Example responses:
{"category":"hustle","contentType":"note","fieldValues":null}
{"category":"beans","contentType":"expense","fieldValues":{"amount":35,"currency":"CNY","category":"Food","subcategory":"Cafe"}}
{"category":"craft","contentType":"task","fieldValues":{"done":false}}
{"category":"sparks","contentType":"bookmark","fieldValues":{"url":"https://example.com/article","title":"Great Article","type":"Article","status":"Inbox"}}
{"category":"hardware","contentType":"mood","fieldValues":{"feeling":"Tired","energy":2,"trigger":"Work"}}`;

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
