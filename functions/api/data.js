// GET /api/data - Fetch user data from KV
// PUT /api/data - Save user data to KV

import { verifyAuth, corsHeaders, unauthorizedResponse } from './_auth.js';

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
      }, { headers: corsHeaders });
    }

    return Response.json(data, { headers: corsHeaders });
  } catch (error) {
    return Response.json({ error: 'Failed to fetch data' }, { status: 500, headers: corsHeaders });
  }
}

// Handle OPTIONS preflight request
export async function onRequestOptions() {
  return new Response(null, { headers: corsHeaders });
}

// Send webhook notification to OpenClaw for new entries
async function notifyOpenClaw(entry, env) {
  try {
    const webhookSecret = env.OPENCLAW_WEBHOOK_SECRET || 'chronolog-webhook-secret';
    await fetch('http://68.233.124.109:18789/hooks/wake', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${webhookSecret}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        text: `新日志: ${entry.content}`,
        mode: 'now'
      })
    });
  } catch (error) {
    // Fail silently - don't block the main request
    console.error('OpenClaw webhook failed:', error);
  }
}

export async function onRequestPut(context) {
  const { request, env } = context;

  // Verify authentication
  const auth = await verifyAuth(request, env);
  if (!auth.valid) {
    return unauthorizedResponse(auth.error);
  }

  try {
    const data = await request.json();

    // Validate data structure
    if (!data || typeof data !== 'object') {
      return Response.json({ error: 'Invalid data format' }, { status: 400, headers: corsHeaders });
    }

    // Get existing data to detect new entries
    const existingData = await env.CHRONOLOG_KV.get('user_data', 'json');
    const existingEntryIds = new Set(
      (existingData?.entries || []).map(e => e.id)
    );

    // Find new entries (entries that don't exist in the old data)
    const newEntries = (data.entries || []).filter(
      entry => !existingEntryIds.has(entry.id)
    );

    // Add lastModified timestamp
    const dataToSave = {
      ...data,
      lastModified: Date.now()
    };

    // Save to KV
    await env.CHRONOLOG_KV.put('user_data', JSON.stringify(dataToSave));

    // Send webhook notifications for new entries (don't await - fire and forget)
    for (const entry of newEntries) {
      // Only notify for entries with content (skip SESSION_START/SESSION_END without meaningful content)
      if (entry.content && entry.content.trim()) {
        notifyOpenClaw(entry, env);
      }
    }

    return Response.json({
      success: true,
      lastModified: dataToSave.lastModified
    }, { headers: corsHeaders });
  } catch (error) {
    return Response.json({ error: 'Failed to save data' }, { status: 500, headers: corsHeaders });
  }
}
