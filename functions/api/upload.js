// POST /api/upload - Upload image to R2 and return URL
// Requires authentication

import { verifyAuth, corsHeaders, unauthorizedResponse } from './_auth.js';

// Handle OPTIONS preflight request
export async function onRequestOptions() {
    return new Response(null, { headers: corsHeaders });
}

export async function onRequestPost(context) {
    const { request, env } = context;

    // Verify authentication
    const auth = await verifyAuth(request, env);
    if (!auth.valid) {
        return unauthorizedResponse(auth.error);
    }

    try {
        const contentType = request.headers.get('Content-Type') || '';

        // Handle multipart form data
        if (contentType.includes('multipart/form-data')) {
            const formData = await request.formData();
            const file = formData.get('file');

            if (!file || !(file instanceof File)) {
                return Response.json({ error: 'No file provided' }, { status: 400, headers: corsHeaders });
            }

            // Validate file type
            const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
            if (!allowedTypes.includes(file.type)) {
                return Response.json({ error: 'Invalid file type' }, { status: 400, headers: corsHeaders });
            }

            // Validate file size (10MB max)
            if (file.size > 10 * 1024 * 1024) {
                return Response.json({ error: 'File too large (max 10MB)' }, { status: 400, headers: corsHeaders });
            }

            // Generate unique filename
            const ext = file.name.split('.').pop() || 'jpg';
            const filename = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;

            // Upload to R2
            await env.CHRONOLOG_R2.put(filename, file.stream(), {
                httpMetadata: {
                    contentType: file.type,
                },
            });

            // Return the image URL
            const url = new URL(request.url);
            const imageUrl = `${url.origin}/api/image/${filename}`;

            return Response.json({
                success: true,
                url: imageUrl,
                filename
            }, { headers: corsHeaders });
        }

        return Response.json({ error: 'Invalid content type' }, { status: 400, headers: corsHeaders });
    } catch (error) {
        console.error('Upload error:', error);
        return Response.json({ error: 'Failed to upload file' }, { status: 500, headers: corsHeaders });
    }
}
