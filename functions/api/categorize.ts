// POST /api/categorize - AI-powered entry categorization and content type detection
// GET  /api/categorize - AI health check (real categorization round-trip)
// Uses AI config from Cloudflare environment variables

import type { CFContext, Env } from './types.ts';
import { corsHeaders } from './_auth.ts';

interface Category {
    id: string;
    label: string;
    description?: string;
}

interface CategorizeRequest {
    content: string;
    categories: Category[];
    contentTypes?: Array<{ id: string; name: string }>;
}

interface AIResponse {
    category: string | null;
    contentType: string;
    fieldValues: Record<string, unknown> | null;
}

interface AIConfig {
    apiKey: string;
    baseUrl: string;
    model: string;
}

function getAIConfig(env: Env): AIConfig | null {
    if (!env.AI_API_KEY) return null;
    return {
        apiKey: env.AI_API_KEY,
        baseUrl: env.AI_BASE_URL || 'https://api.openai.com/v1',
        model: env.AI_MODEL || 'gpt-4o-mini',
    };
}

function buildPrompt(content: string, categories: Category[], contentTypes?: Array<{ id: string; name: string }>): string {
    const categoryList = categories.map(c => `${c.id} (${c.label}): ${c.description || c.label}`).join('\\n');

    // Content types for detection (built-in: note, task, bookmark, mood, workout)
    const contentTypeList = contentTypes
        ? contentTypes.map(ct => `${ct.id}: ${ct.name}`).join(', ')
        : 'note: regular note, task: todo item, bookmark: saved link, mood: emotional state, workout: exercise log';

    return `You are an entry analyzer. Analyze this log entry and return a JSON object.

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
- If entry expresses feelings, emotions, or mood (feeling/心情/feel/累/开心/sad/happy/tired/stressed/anxious), it's "mood"
- If entry describes exercise/workout/running/gym/training/锻炼/跑步/健身, it's "workout"
- Otherwise, it's "note"

FieldValues by content type:
- bookmark: {url: "extracted URL", title: "title from content", type: "Article"|"Video"|"Tool"|"Paper", status: "Inbox"}
- mood: {feeling: "Happy"|"Calm"|"Tired"|"Anxious"|"Sad"|"Angry", energy: 1-5, trigger: "Work"|"Health"|"Social"|"Money"|"Family"|"Sleep"|"Weather"|"Other"}
- workout: {workoutType: "Strength"|"Cardio"|"Flexibility"|"Mixed", place: "Home"|"In Building Gym"|"Outside Gym", exercises: "comma-separated exercise names"}
- vault: {title: "note title", obsidianUrl: "obsidian://open?vault=VaultName&file=NotePath"}
- note: null

Mood hints: 开心/excited/joyful = Happy, 平静/relaxed = Calm, 累/疲惫/sleepy = Tired, 焦虑/stressed/nervous = Anxious, 难过/down/upset = Sad, 生气/frustrated = Angry
Trigger hints: 工作/office/deadline/meeting = Work, 身体/sick/headache = Health, 朋友/party/social = Social, 钱/broke/expensive = Money, 家/parents = Family, 睡眠/insomnia/晚睡 = Sleep, rain/hot/cold = Weather
Energy hints: very tired/exhausted = 1, tired = 2, normal/okay = 3, energetic = 4, very energetic = 5
Vault hints: if content contains "obsidian://" URL, use vault contentType. Extract note title from content or URL file parameter.

Example responses:
{"category":"hustle","contentType":"note","fieldValues":null}
{"category":"sparks","contentType":"bookmark","fieldValues":{"url":"https://example.com/article","title":"Great Article","type":"Article","status":"Inbox"}}
{"category":"hardware","contentType":"mood","fieldValues":{"feeling":"Tired","energy":2,"trigger":"Work"}}
{"category":"hardware","contentType":"workout","fieldValues":{"workoutType":"Strength","place":"Outside Gym","exercises":"bench press, squat, deadlift"}}
{"category":"craft","contentType":"vault","fieldValues":{"title":"React Fiber Architecture","obsidianUrl":"obsidian://open?vault=Notes&file=React/Fiber"}}`;
}

/**
 * Call the AI and parse the categorization JSON out of its response.
 * Deliberately sends no max_tokens: the JSON output is small, and a cap
 * starves reasoning models (which spend tokens thinking before answering)
 * into returning empty content.
 * Throws Error with a user-facing message on API failure.
 */
async function callAI(config: AIConfig, prompt: string): Promise<{ parsed: AIResponse | null; raw: string }> {
    const response = await fetch(`${config.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify({
            model: config.model,
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.1,
        }),
    });

    if (!response.ok) {
        const error = await response.json<{ error?: { message?: string } }>().catch(() => ({}));
        const detail = (error as { error?: { message?: string } }).error?.message;
        throw new Error(detail || `AI API 返回 ${response.status}`);
    }

    const result = await response.json<{
        choices?: Array<{ message?: { content?: string } }>;
    }>();
    const raw = result.choices?.[0]?.message?.content?.trim() || '';

    let parsed: AIResponse | null = null;
    try {
        // Extract JSON from response (handle markdown code blocks)
        const jsonMatch = raw.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            parsed = JSON.parse(jsonMatch[0]);
        }
    } catch {
        parsed = null;
    }

    return { parsed, raw };
}

// GET /api/categorize - AI health check
// Runs a REAL categorization round-trip on a fixed sample entry and verifies the
// response parses, so it catches "key valid but model returns unusable output"
// (e.g. empty content from reasoning models), not just auth failures.
// Auth is enforced by _middleware.ts like every other non-public API route.
export async function onRequestGet(context: CFContext): Promise<Response> {
    const config = getAIConfig(context.env);
    if (!config) {
        return Response.json(
            { ok: false, error: 'AI_API_KEY 未配置 (Cloudflare 环境变量)' },
            { headers: corsHeaders }
        );
    }

    const sampleCategories: Category[] = [
        { id: 'hardware', label: 'Hardware', description: 'Sleep, eating, workout, physical/mental health' },
        { id: 'craft', label: 'Craft', description: 'Coding, drawing, creating, building projects' },
    ];

    try {
        const prompt = buildPrompt('went for a 5km run, exhausted', sampleCategories);
        const { parsed, raw } = await callAI(config, prompt);

        if (!parsed) {
            const excerpt = raw ? raw.slice(0, 120) : '(空响应)';
            return Response.json(
                { ok: false, model: config.model, error: `模型响应无法解析为 JSON: ${excerpt}` },
                { headers: corsHeaders }
            );
        }

        return Response.json({
            ok: true,
            model: config.model,
            sample: { category: parsed.category, contentType: parsed.contentType },
        }, { headers: corsHeaders });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'AI API 无法访问';
        return Response.json(
            { ok: false, model: config.model, error: message },
            { headers: corsHeaders }
        );
    }
}

export async function onRequestPost(context: CFContext): Promise<Response> {
    const { request, env } = context;

    // Auth already verified by _middleware.ts

    try {
        const config = getAIConfig(env);
        if (!config) {
            return Response.json({ error: 'AI not configured' }, { status: 500, headers: corsHeaders });
        }

        // Get request body
        const { content, categories, contentTypes } = await request.json<CategorizeRequest>();
        if (!content || !categories || !Array.isArray(categories)) {
            return Response.json({ error: 'Invalid request body' }, { status: 400, headers: corsHeaders });
        }

        const prompt = buildPrompt(content, categories, contentTypes);

        let aiResult: { parsed: AIResponse | null; raw: string };
        try {
            aiResult = await callAI(config, prompt);
        } catch (error) {
            const message = error instanceof Error ? error.message : 'AI API error';
            return Response.json({ error: message }, { status: 502, headers: corsHeaders });
        }

        const { parsed, raw } = aiResult;
        if (!parsed) {
            console.error('Failed to parse AI response:', raw);
        }

        // Validate category ID
        const validCategory = parsed && categories.find(c => c.id === parsed.category);

        return Response.json({
            category: validCategory ? parsed!.category : null,
            contentType: parsed?.contentType || 'note',
            fieldValues: parsed?.fieldValues || null,
            raw,
        }, { headers: corsHeaders });

    } catch (error) {
        const message = error instanceof Error ? error.message : 'Categorization failed';
        return Response.json(
            { error: message },
            { status: 500, headers: corsHeaders }
        );
    }
}
