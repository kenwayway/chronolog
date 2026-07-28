import { describe, expect, it } from 'vitest';
import {
    buildGoogleAuthorizationUrl,
    grantedScopes,
    isGoogleUserAllowed,
    validateClientRegistration,
} from './auth.ts';

describe('MCP Google OAuth helpers', () => {
    const user = {
        sub: 'google-subject-123',
        email: 'Owner@Example.com',
        email_verified: true,
    };

    it('allows only verified identities on the configured allowlist', () => {
        expect(isGoogleUserAllowed(user, 'other@example.com, owner@example.com', undefined)).toBe(true);
        expect(isGoogleUserAllowed(user, undefined, 'google-subject-123')).toBe(true);
        expect(isGoogleUserAllowed(user, undefined, 'GOOGLE-SUBJECT-123')).toBe(false);
        expect(isGoogleUserAllowed({ ...user, email_verified: false }, user.email, user.sub)).toBe(false);
        expect(isGoogleUserAllowed(user, undefined, undefined)).toBe(false);
    });

    it('defaults to read and write and makes write imply read', () => {
        expect(grantedScopes([])).toEqual(['chronolog:read', 'chronolog:write']);
        expect(grantedScopes(['chronolog:write'])).toEqual(['chronolog:read', 'chronolog:write']);
        expect(grantedScopes(['unknown'])).toEqual([]);
    });

    it('builds a minimal Google OpenID request', () => {
        const url = new URL(buildGoogleAuthorizationUrl('client-id', 'https://mcp.test/callback', 'state'));
        expect(url.origin + url.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
        expect(url.searchParams.get('client_id')).toBe('client-id');
        expect(url.searchParams.get('redirect_uri')).toBe('https://mcp.test/callback');
        expect(url.searchParams.get('scope')).toBe('openid email profile');
        expect(url.searchParams.get('state')).toBe('state');
    });

    it('accepts only approved callback URLs during dynamic registration', () => {
        expect(validateClientRegistration({
            redirect_uris: ['https://claude.ai/api/mcp/auth_callback'],
        })).toBeUndefined();
        expect(validateClientRegistration({
            redirect_uris: ['https://zaddy.sopoi.com/oauth/chronolog/callback'],
        })).toBeUndefined();
        expect(validateClientRegistration({
            redirect_uris: ['http://localhost:3000/callback'],
        })).toEqual(expect.objectContaining({ description: expect.any(String) }));
        expect(validateClientRegistration({
            redirect_uris: ['https://zaddy.sopoi.com.evil.example/oauth/chronolog/callback'],
        })).toEqual(expect.objectContaining({ description: expect.any(String) }));
    });
});
