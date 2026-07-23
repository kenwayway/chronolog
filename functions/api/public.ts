import { corsHeaders } from './_auth.ts';
import { noteRowToObject, sessionRowToObject } from './_db.ts';
import type { CFContext, NoteRow, SessionRow } from './types.ts';

export async function onRequestGet(context: CFContext): Promise<Response> {
    const { request, env } = context;
    const url = new URL(request.url);
    if (!env.PUBLIC_API_TOKEN || url.searchParams.get('token') !== env.PUBLIC_API_TOKEN) {
        return Response.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });
    }

    try {
        const start = url.searchParams.get('start');
        const end = url.searchParams.get('end');
        const limit = Math.min(Math.max(Number(url.searchParams.get('limit') || 1000), 1), 5000);
        const conditions: string[] = [];
        const bindings: number[] = [];
        if (start) {
            conditions.push('timestamp >= ?');
            bindings.push(new Date(start).getTime());
        }
        if (end) {
            conditions.push('timestamp <= ?');
            bindings.push(new Date(end).getTime());
        }

        const noteWhere = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
        const notes = await env.CHRONOLOG_DB.prepare(
            `SELECT * FROM notes ${noteWhere} ORDER BY timestamp DESC LIMIT ?`
        ).bind(...bindings, limit).all<NoteRow>();

        const sessionWhere = conditions.length
            ? `WHERE ${conditions.map(condition => condition.replace('timestamp', 'start_at')).join(' AND ')}`
            : '';
        const sessions = await env.CHRONOLOG_DB.prepare(
            `SELECT * FROM sessions ${sessionWhere} ORDER BY start_at DESC LIMIT ?`
        ).bind(...bindings, limit).all<SessionRow>();

        return Response.json({
            notes: notes.results.map(noteRowToObject),
            sessions: sessions.results.map(sessionRowToObject),
            count: notes.results.length + sessions.results.length,
        }, { headers: corsHeaders });
    } catch (error) {
        console.error('Public data fetch error:', error);
        return Response.json({ error: 'Failed to fetch data' }, { status: 500, headers: corsHeaders });
    }
}

export async function onRequestOptions(): Promise<Response> {
    return new Response(null, { headers: corsHeaders });
}
