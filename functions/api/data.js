// GET /api/data - Fetch user data from KV
// PUT /api/data - Save user data to KV

export async function onRequestGet(context) {
  const { env } = context;

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  try {
    const data = await env.CHRONOLOG_KV.get('user_data', 'json');

    if (!data) {
      return Response.json({
        entries: [],
        tasks: [],
        categories: null,
        lastModified: null
      }, { headers: corsHeaders });
    }

    return Response.json(data, { headers: corsHeaders });
  } catch (error) {
    return Response.json({ error: 'Failed to fetch data' }, { status: 500, headers: corsHeaders });
  }
}

// Handle OPTIONS preflight request
export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    }
  });
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
