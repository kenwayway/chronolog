// Middleware for CORS and auth
import type { Env } from './api/types.ts';

export async function onRequest(context: EventContext<Env, string, unknown>): Promise<Response> {
    const { request, env, next } = context;

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
        return new Response(null, {
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization',
                'Access-Control-Max-Age': '86400',
            },
        });
    }

    // Skip auth for public endpoints
    const url = new URL(request.url);

    // Public routes: auth, image serving, data reading (GET only), public entries API, and external comment API
    const isPublicRoute =
        url.pathname === '/api/auth' ||
        url.pathname.startsWith('/api/image/') ||
        url.pathname === '/api/entries/public' ||
        !!url.pathname.match(/^\/api\/entries\/[^/]+\/comment$/) ||
        (url.pathname === '/api/data' && request.method === 'GET');

    if (isPublicRoute) {
        const response = await next();
        return addCorsHeaders(response);
    }

    // Check auth for all other API routes
    if (url.pathname.startsWith('/api/')) {
        const authHeader = request.headers.get('Authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), {
                status: 401,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                },
            });
        }

        const token = authHeader.slice(7);
        // Multi-device token validation: check if this specific token exists
        const tokenValid = await env.CHRONOLOG_KV.get(`auth_token:${token}`);
        if (!tokenValid) {
            return new Response(JSON.stringify({ error: 'Invalid token' }), {
                status: 401,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                },
            });
        }
    }

    const response = await next();
    return addCorsHeaders(response);
}

function addCorsHeaders(response: Response): Response {
    const newHeaders = new Headers(response.headers);
    newHeaders.set('Access-Control-Allow-Origin', '*');
    return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: newHeaders,
    });
}
