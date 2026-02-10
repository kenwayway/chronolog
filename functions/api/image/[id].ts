// GET /api/image/[id] - Serve image from R2

import type { CFContext } from '../types.ts';

export async function onRequestGet(context: CFContext<'id'>): Promise<Response> {
    const { params, env } = context;
    const id = Array.isArray(params.id) ? params.id[0] : params.id;

    try {
        const object = await env.CHRONOLOG_R2.get(id);

        if (!object) {
            return new Response('Image not found', { status: 404 });
        }

        const headers = new Headers();
        headers.set('Content-Type', object.httpMetadata?.contentType || 'image/jpeg');
        headers.set('Cache-Control', 'public, max-age=31536000'); // 1 year cache
        headers.set('Access-Control-Allow-Origin', '*');

        return new Response(object.body, { headers });
    } catch {
        return new Response('Failed to fetch image', { status: 500 });
    }
}
