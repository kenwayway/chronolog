// POST /api/auth - Authenticate with password
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

        // Generate a simple token (in production, use JWT)
        const token = crypto.randomUUID() + '-' + Date.now();

        // Store token in KV with 30 day expiration
        await env.CHRONOLOG_KV.put('auth_token', token, { expirationTtl: 30 * 24 * 60 * 60 });

        return Response.json({
            success: true,
            token,
            expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000
        });
    } catch (error) {
        return Response.json({ error: 'Invalid request' }, { status: 400 });
    }
}
