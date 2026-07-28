import {
    OAuthProvider,
    type AuthRequest,
    type OAuthHelpers,
} from '@cloudflare/workers-oauth-provider';
import { WorkerEntrypoint } from 'cloudflare:workers';
import { handleMcpRequest } from '../functions/api/mcp.ts';
import type { Env as ChronologEnv } from '../functions/api/types.ts';
import {
    buildGoogleAuthorizationUrl,
    grantedScopes,
    isGoogleUserAllowed,
    oauthErrorRedirect,
    type GoogleUser,
    type StoredGoogleAuthorization,
    validateClientRegistration,
} from './auth.ts';

interface McpWorkerEnv extends ChronologEnv {
    OAUTH_KV: KVNamespace;
    OAUTH_PROVIDER: OAuthHelpers;
    GOOGLE_CLIENT_ID: string;
    GOOGLE_CLIENT_SECRET: string;
    GOOGLE_REDIRECT_URI?: string;
    ALLOWED_GOOGLE_EMAILS?: string;
    ALLOWED_GOOGLE_SUBJECTS?: string;
}

interface McpAuthProps {
    googleSubject: string;
    email: string;
    scopes: string[];
}

interface GoogleTokenResponse {
    access_token?: string;
    error?: string;
    error_description?: string;
}

const GOOGLE_STATE_TTL_SECONDS = 10 * 60;

function textResponse(message: string, status = 200): Response {
    return new Response(message, {
        status,
        headers: {
            'Content-Type': 'text/plain; charset=utf-8',
            'Cache-Control': 'no-store',
            'X-Content-Type-Options': 'nosniff',
        },
    });
}

function googleRedirectUri(request: Request, env: McpWorkerEnv): string {
    return env.GOOGLE_REDIRECT_URI || `${new URL(request.url).origin}/oauth/google/callback`;
}

function ensureGoogleConfiguration(env: McpWorkerEnv): Response | null {
    if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
        return textResponse('Google OAuth is not configured.', 503);
    }
    if (!env.ALLOWED_GOOGLE_EMAILS && !env.ALLOWED_GOOGLE_SUBJECTS) {
        return textResponse('No Google identities are allowed.', 503);
    }
    return null;
}

async function exchangeGoogleCode(
    code: string,
    redirectUri: string,
    env: McpWorkerEnv,
): Promise<string> {
    const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            code,
            client_id: env.GOOGLE_CLIENT_ID,
            client_secret: env.GOOGLE_CLIENT_SECRET,
            redirect_uri: redirectUri,
            grant_type: 'authorization_code',
        }),
    });
    const result = await response.json<GoogleTokenResponse>();
    if (!response.ok || !result.access_token) {
        throw new Error(result.error_description || result.error || 'Google token exchange failed');
    }
    return result.access_token;
}

async function fetchGoogleUser(accessToken: string): Promise<GoogleUser> {
    const response = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) throw new Error('Google user lookup failed');
    const user = await response.json<Partial<GoogleUser>>();
    if (
        typeof user.sub !== 'string'
        || typeof user.email !== 'string'
        || typeof user.email_verified !== 'boolean'
    ) {
        throw new Error('Google returned an incomplete identity');
    }
    return user as GoogleUser;
}

class DefaultHandler extends WorkerEntrypoint<McpWorkerEnv> {
    async fetch(request: Request): Promise<Response> {
        const url = new URL(request.url);
        if (url.pathname === '/') {
            return Response.json({
                name: 'Chronolog MCP',
                mcp: `${url.origin}/mcp`,
                authorization: 'Google OAuth',
            });
        }
        if (url.pathname === '/authorize' && request.method === 'GET') {
            return this.beginAuthorization(request);
        }
        if (url.pathname === '/oauth/google/callback' && request.method === 'GET') {
            return this.finishAuthorization(request);
        }
        return textResponse('Not found', 404);
    }

    private async beginAuthorization(request: Request): Promise<Response> {
        const configurationError = ensureGoogleConfiguration(this.env);
        if (configurationError) return configurationError;

        let oauthRequest: AuthRequest;
        try {
            oauthRequest = await this.env.OAUTH_PROVIDER.parseAuthRequest(request);
            const client = await this.env.OAUTH_PROVIDER.lookupClient(oauthRequest.clientId);
            if (!client) return textResponse('Unknown OAuth client.', 400);
        } catch (error) {
            return textResponse(error instanceof Error ? error.message : 'Invalid OAuth request', 400);
        }

        const state = crypto.randomUUID().replaceAll('-', '') + crypto.randomUUID().replaceAll('-', '');
        const stored: StoredGoogleAuthorization = { request: oauthRequest, createdAt: Date.now() };
        await this.env.OAUTH_KV.put(`google-state:${state}`, JSON.stringify(stored), {
            expirationTtl: GOOGLE_STATE_TTL_SECONDS,
        });

        return Response.redirect(buildGoogleAuthorizationUrl(
            this.env.GOOGLE_CLIENT_ID,
            googleRedirectUri(request, this.env),
            state,
        ), 302);
    }

    private async finishAuthorization(request: Request): Promise<Response> {
        const configurationError = ensureGoogleConfiguration(this.env);
        if (configurationError) return configurationError;

        const url = new URL(request.url);
        const state = url.searchParams.get('state');
        if (!state) return textResponse('Missing OAuth state.', 400);

        const key = `google-state:${state}`;
        const stored = await this.env.OAUTH_KV.get<StoredGoogleAuthorization>(key, 'json');
        if (!stored) return textResponse('OAuth state is invalid or expired.', 400);
        await this.env.OAUTH_KV.delete(key);

        const googleError = url.searchParams.get('error');
        if (googleError) {
            return oauthErrorRedirect(
                stored.request,
                'access_denied',
                url.searchParams.get('error_description') || 'Google sign-in was cancelled.',
            );
        }
        const code = url.searchParams.get('code');
        if (!code) return oauthErrorRedirect(stored.request, 'access_denied', 'Google returned no code.');

        try {
            const accessToken = await exchangeGoogleCode(code, googleRedirectUri(request, this.env), this.env);
            const user = await fetchGoogleUser(accessToken);
            if (!isGoogleUserAllowed(
                user,
                this.env.ALLOWED_GOOGLE_EMAILS,
                this.env.ALLOWED_GOOGLE_SUBJECTS,
            )) {
                return oauthErrorRedirect(stored.request, 'access_denied', 'This Google account is not allowed.');
            }

            const scopes = grantedScopes(stored.request.scope);
            if (scopes.length === 0) {
                return oauthErrorRedirect(stored.request, 'invalid_scope', 'No supported scope was requested.');
            }
            const { redirectTo } = await this.env.OAUTH_PROVIDER.completeAuthorization({
                request: stored.request,
                userId: `google-${user.sub}`,
                metadata: { email: user.email },
                scope: scopes,
                props: {
                    googleSubject: user.sub,
                    email: user.email,
                    scopes,
                } satisfies McpAuthProps,
            });
            return Response.redirect(redirectTo, 302);
        } catch (error) {
            console.error('Google OAuth callback failed', error);
            return oauthErrorRedirect(stored.request, 'server_error', 'Google sign-in could not be completed.');
        }
    }
}

class McpApiHandler extends WorkerEntrypoint<McpWorkerEnv, McpAuthProps> {
    fetch(request: Request): Promise<Response> {
        if (new URL(request.url).pathname !== '/mcp') {
            return Promise.resolve(textResponse('Not found', 404));
        }
        const canWrite = this.ctx.props.scopes.includes('chronolog:write');
        return handleMcpRequest(request, this.env, canWrite);
    }
}

function createOAuthProvider(origin: string): OAuthProvider<McpWorkerEnv> {
    const resource = `${origin}/mcp`;
    return new OAuthProvider<McpWorkerEnv>({
        apiRoute: '/mcp',
        apiHandler: McpApiHandler,
        defaultHandler: DefaultHandler,
        authorizeEndpoint: `${origin}/authorize`,
        tokenEndpoint: `${origin}/token`,
        clientRegistrationEndpoint: `${origin}/register`,
        scopesSupported: ['chronolog:read', 'chronolog:write'],
        allowPlainPKCE: false,
        allowImplicitFlow: false,
        accessTokenTTL: 60 * 60,
        refreshTokenTTL: 30 * 24 * 60 * 60,
        clientRegistrationTTL: 90 * 24 * 60 * 60,
        resourceMetadata: {
            resource,
            authorization_servers: [origin],
            scopes_supported: ['chronolog:read', 'chronolog:write'],
            bearer_methods_supported: ['header'],
            resource_name: 'Chronolog',
        },
        clientRegistrationCallback: ({ clientMetadata }) => validateClientRegistration(clientMetadata),
        onError: error => {
            console.warn('OAuth provider error', error.status, error.code, error.description);
        },
    });
}

export default {
    fetch(request: Request, env: McpWorkerEnv, ctx: ExecutionContext): Promise<Response> {
        return createOAuthProvider(new URL(request.url).origin).fetch(request, env, ctx);
    },
};
