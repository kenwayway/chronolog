// GET /api/data - Fetch user data from KV
// PUT /api/data - Save user data to KV

export async function onRequestGet(context) {
    const { env } = context;

    try {
        const data = await env.CHRONOLOG_KV.get('user_data', 'json');

        if (!data) {
            return Response.json({
                entries: [],
                tasks: [],
                categories: null,
                lastModified: null
            });
        }

        return Response.json(data);
    } catch (error) {
        return Response.json({ error: 'Failed to fetch data' }, { status: 500 });
    }
}

export async function onRequestPut(context) {
    const { request, env } = context;

    try {
        const data = await request.json();

        // Validate data structure
        if (!data || typeof data !== 'object') {
            return Response.json({ error: 'Invalid data format' }, { status: 400 });
        }

        // Add lastModified timestamp
        const dataToSave = {
            ...data,
            lastModified: Date.now()
        };

        // Save to KV
        await env.CHRONOLOG_KV.put('user_data', JSON.stringify(dataToSave));

        return Response.json({
            success: true,
            lastModified: dataToSave.lastModified
        });
    } catch (error) {
        return Response.json({ error: 'Failed to save data' }, { status: 500 });
    }
}
