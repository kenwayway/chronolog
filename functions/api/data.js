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
  const webhookSecret = env.OPENCLAW_WEBHOOK_SECRET || 'chronolog-webhook-secret';
  const response = await fetch('https://claw.233446.xyz/hooks/wake', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${webhookSecret}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      entryId: entry.id,
      text: `新日志: ${entry.content}`,
      mode: 'now'
    })
  });
  console.log('OpenClaw webhook response:', response.status);
}

export async function onRequestPut(context) {
  const { request, env, waitUntil } = context;

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

    // Send webhook notifications for new entries using waitUntil to keep worker alive
    for (const entry of newEntries) {
      // Only notify for entries with content (skip SESSION_START/SESSION_END without meaningful content)
      if (entry.content && entry.content.trim()) {
        waitUntil(notifyOpenClaw(entry, env));
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
