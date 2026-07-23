import { corsHeaders } from '../_auth.ts';
import type { CFContext } from '../types.ts';
import { normalizeNotionPageId } from '../../../src/utils/notionPageId.ts';

const NOTION_VERSION = '2026-03-11';

interface NotionRichText {
    plain_text?: string;
    text?: { content?: string };
}

interface NotionPageProperty {
    type?: string;
    title?: NotionRichText[];
}

interface NotionPageResponse {
    id?: string;
    url?: string;
    properties?: Record<string, NotionPageProperty>;
}

export function extractNotionTaskName(page: NotionPageResponse): string | null {
    const titleProperty = Object.values(page.properties || {}).find(property => property.type === 'title');
    const name = titleProperty?.title
        ?.map(item => item.plain_text || item.text?.content || '')
        .join('')
        .trim();
    return name || null;
}

// GET /api/notion/task?id=<page-id> - resolve a task title without exposing the Notion token.
export async function onRequestGet(context: CFContext): Promise<Response> {
    const { request, env } = context;
    const pageId = normalizeNotionPageId(new URL(request.url).searchParams.get('id'));
    if (!pageId) {
        return Response.json({ error: 'Invalid Notion page ID' }, { status: 400, headers: corsHeaders });
    }

    const token = env.NOTION_API_TOKEN?.trim();
    if (!token) {
        return Response.json({ error: 'Notion integration is not configured' }, { status: 503, headers: corsHeaders });
    }

    try {
        const response = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
            headers: {
                Authorization: `Bearer ${token}`,
                'Notion-Version': NOTION_VERSION,
            },
            signal: AbortSignal.timeout(10_000),
        });
        if (!response.ok) {
            const body = await response.text().catch(() => '');
            return Response.json(
                { error: `Notion ${response.status}: ${body || response.statusText}` },
                { status: response.status === 404 ? 404 : 502, headers: corsHeaders },
            );
        }

        const page = await response.json<NotionPageResponse>();
        return Response.json({
            id: pageId,
            name: extractNotionTaskName(page) || 'Untitled task',
            url: page.url || `https://www.notion.so/${pageId.replace(/-/g, '')}`,
        }, {
            headers: {
                ...corsHeaders,
                'Cache-Control': 'private, max-age=300',
            },
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return Response.json({ error: `Notion request failed: ${message}` }, { status: 502, headers: corsHeaders });
    }
}
