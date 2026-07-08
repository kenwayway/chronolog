// GET /api/image/[id] - Serve image from R2, with optional on-the-fly resizing
//
// Query params:
//   ?w=300   — resize to 300px wide (aspect-ratio preserved), output as WebP
//              Omit to serve the original at full resolution.

import type { CFContext } from '../types.ts';

export async function onRequestGet(context: CFContext<'id'>): Promise<Response> {
    const { params, env, request } = context;
    const id = Array.isArray(params.id) ? params.id[0] : params.id;

    try {
        const object = await env.CHRONOLOG_R2.get(id);

        if (!object) {
            return new Response('Image not found', { status: 404 });
        }

        const url = new URL(request.url);
        const widthParam = url.searchParams.get('w');
        const width = widthParam ? parseInt(widthParam, 10) : null;

        // If a width is requested and the Images binding is available, resize
        if (width && width > 0 && env.IMAGES) {
            try {
                const input = env.IMAGES.input(object.body);
                const output = await input
                    .resize({ width, fit: 'scale-down' })
                    .output({ format: 'image/webp', quality: 80 });

                return new Response(output.image(), {
                    headers: {
                        'Content-Type': 'image/webp',
                        'Cache-Control': 'public, max-age=31536000',
                        'Access-Control-Allow-Origin': '*',
                    },
                });
            } catch (e) {
                // If image transform fails (e.g. GIF, unsupported format),
                // fall through to serve the original
                console.error('Image resize failed, serving original:', e);
            }
        }

        // Serve original (no resize requested or resize failed)
        const headers = new Headers();
        headers.set('Content-Type', object.httpMetadata?.contentType || 'image/jpeg');
        headers.set('Cache-Control', 'public, max-age=31536000'); // 1 year cache
        headers.set('Access-Control-Allow-Origin', '*');

        return new Response(object.body, { headers });
    } catch {
        return new Response('Failed to fetch image', { status: 500 });
    }
}
