// POST /api/auth - Authenticate with password
// Supports multi-device: each login creates a unique token
export async function onRequestPost(context) {
    const { request, env } = context;

    try {
        const { password } = await request.json();

        // Get password from environment variable
        const correctPassword = env.AUTH_PASSWORD;

        if (!correctPassword) {
            return Response.json({ error: 'Server not configured' }, { status: 500 });
        }

        if (password !== correctPassword) {
            return Response.json({ error: 'Invalid password' }, { status: 401 });
        }

        // Generate a unique token for this device
        const token = crypto.randomUUID() + '-' + Date.now();

        // Store token with unique key (supports multiple devices)
        // Key format: auth_token:{token} - each device gets its own entry
        await env.CHRONOLOG_KV.put(`auth_token:${token}`, 'valid', {
            expirationTtl: 30 * 24 * 60 * 60  // 30 days
        });

        return Response.json({
            success: true,
            token,
            expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000
        });
    } catch (error) {
        return Response.json({ error: 'Invalid request' }, { status: 400 });
    }
}
