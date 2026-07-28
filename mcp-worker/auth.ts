import type { AuthRequest, ClientRegistrationCallbackResult } from '@cloudflare/workers-oauth-provider';

export const MCP_SCOPES = ['chronolog:read', 'chronolog:write'] as const;

export interface GoogleUser {
    sub: string;
    email: string;
    email_verified: boolean;
    name?: string;
    picture?: string;
}

export interface StoredGoogleAuthorization {
    request: AuthRequest;
    createdAt: number;
}

function parseAllowList(value: string | undefined, lowercase: boolean): Set<string> {
    return new Set(
        (value ?? '')
            .split(',')
            .map(item => item.trim())
            .map(item => lowercase ? item.toLowerCase() : item)
            .filter(Boolean),
    );
}

export function isGoogleUserAllowed(
    user: GoogleUser,
    allowedEmails: string | undefined,
    allowedSubjects: string | undefined,
): boolean {
    if (!user.email_verified) return false;
    const emails = parseAllowList(allowedEmails, true);
    const subjects = parseAllowList(allowedSubjects, false);
    if (emails.size === 0 && subjects.size === 0) return false;
    return emails.has(user.email.toLowerCase()) || subjects.has(user.sub);
}

export function grantedScopes(requested: string[]): string[] {
    const supported = new Set<string>(MCP_SCOPES);
    const selected = requested.length === 0
        ? [...MCP_SCOPES]
        : requested.filter(scope => supported.has(scope));
    if (selected.includes('chronolog:write') && !selected.includes('chronolog:read')) {
        selected.unshift('chronolog:read');
    }
    return [...new Set(selected)];
}

export function buildGoogleAuthorizationUrl(
    clientId: string,
    redirectUri: string,
    state: string,
): string {
    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    url.searchParams.set('client_id', clientId);
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', 'openid email profile');
    url.searchParams.set('state', state);
    url.searchParams.set('prompt', 'select_account');
    return url.toString();
}

export function validateClientRegistration(
    clientMetadata: Record<string, unknown>,
): ClientRegistrationCallbackResult | undefined {
    const redirectUris = clientMetadata.redirect_uris;
    if (!Array.isArray(redirectUris) || redirectUris.length === 0) {
        return { description: 'At least one approved callback URL is required.' };
    }
    const allowed = new Set([
        'https://claude.ai/api/mcp/auth_callback',
        'https://claude.com/api/mcp/auth_callback',
        'https://zaddy.sopoi.com/oauth/chronolog/callback',
    ]);
    const valid = redirectUris.every(uri => typeof uri === 'string' && allowed.has(uri));
    return valid
        ? undefined
        : { description: 'This private MCP server only accepts approved callback URLs.' };
}

export function oauthErrorRedirect(request: AuthRequest, error: string, description: string): Response {
    const redirect = new URL(request.redirectUri);
    redirect.searchParams.set('error', error);
    redirect.searchParams.set('error_description', description);
    redirect.searchParams.set('state', request.state);
    return Response.redirect(redirect.toString(), 302);
}
