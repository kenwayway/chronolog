// POST /api/cleanup - Clean up unreferenced images from R2

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    // Get all entries from KV
    const data = await env.CHRONOLOG_KV.get('user_data', { type: 'json' });
    const entries = data?.entries || [];

    // Extract all image filenames from entries
    const usedImages = new Set();
    entries.forEach(entry => {
      if (entry.content) {
        // Match /api/image/filename pattern
        const matches = entry.content.match(/\/api\/image\/([^\s\n]+)/g);
        if (matches) {
          matches.forEach(match => {
            const filename = match.replace('/api/image/', '');
            usedImages.add(filename);
          });
        }
      }
    });

    // List all objects in R2
    const listed = await env.CHRONOLOG_R2.list();
    const allImages = listed.objects.map(obj => obj.key);

    // Find unreferenced images
    const unreferencedImages = allImages.filter(img => !usedImages.has(img));

    // Delete unreferenced images
    let deletedCount = 0;
    for (const key of unreferencedImages) {
      await env.CHRONOLOG_R2.delete(key);
      deletedCount++;
    }

    return Response.json({
      success: true,
      totalImages: allImages.length,
      usedImages: usedImages.size,
      deletedCount,
      deletedImages: unreferencedImages
    });
  } catch (error) {
    console.error('Cleanup error:', error);
    return Response.json({ error: 'Failed to cleanup images' }, { status: 500 });
  }
}
