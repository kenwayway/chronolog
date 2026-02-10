/**
 * Migration script: KV → D1
 *
 * This script creates a temporary admin endpoint that reads all data from KV
 * and inserts it into D1. Run this ONCE after deploying the D1 schema.
 *
 * Usage:
 *   1. Deploy the app with D1 schema applied
 *   2. Run: node scripts/migrate-kv-to-d1.js <YOUR_AUTH_TOKEN>
 *
 * Or manually call: POST /api/migrate with Authorization: Bearer <token>
 */

const API_BASE = process.env.API_BASE || 'https://chronolog.pages.dev';

async function migrate() {
    const token = process.argv[2];

    if (!token) {
        console.error('Usage: node scripts/migrate-kv-to-d1.js <AUTH_TOKEN>');
        console.error('  Get your auth token from the browser localStorage (chronolog_cloud_auth)');
        process.exit(1);
    }

    console.log('🚀 Starting KV → D1 migration...');
    console.log(`   API Base: ${API_BASE}`);

    try {
        // Call the migration endpoint
        const response = await fetch(`${API_BASE}/api/migrate`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            const error = await response.json();
            console.error('❌ Migration failed:', error);
            process.exit(1);
        }

        const result = await response.json();
        console.log('✅ Migration complete!');
        console.log(`   Entries migrated: ${result.entriesCount}`);
        console.log(`   Content types migrated: ${result.contentTypesCount}`);
        console.log(`   Media items migrated: ${result.mediaItemsCount}`);

    } catch (error) {
        console.error('❌ Migration error:', error.message);
        process.exit(1);
    }
}

migrate();
