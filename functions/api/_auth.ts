// Shared authentication helper for API endpoints
// Validates bearer token against KV-stored auth tokens

import type { Env, AuthResult } from './types.ts';

/**
 * Verify the bearer token from Authorization header
 */
export async function verifyAuth(request: Request, env: Env): Promise<AuthResult> {
    const authHeader = request.headers.get('Authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return { valid: false, error: 'Missing or invalid Authorization header' };
    }

    const token = authHeader.slice(7);

    if (!token) {
        return { valid: false, error: 'Empty token' };
    }

    // Check if token exists in KV (multi-device: stored as auth_token:{token})
    const tokenValid = await env.CHRONOLOG_KV.get(`auth_token:${token}`);

    if (!tokenValid) {
        return { valid: false, error: 'Invalid or expired token' };
    }

    return { valid: true };
}

/**
 * Standard CORS headers for API responses
 */
export const corsHeaders: Record<string, string> = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

/**
 * Create an unauthorized response
 */
export function unauthorizedResponse(message = 'Unauthorized'): Response {
    return Response.json(
        { error: message },
        { status: 401, headers: corsHeaders }
    );
}
