
import 'dotenv/config';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { decrypt } from '@/lib/encryption';

const IGDB_BASE_URL = 'https://api.igdb.com/v4';

async function run() {
    console.log('--- 🕵️ IGDB CATEGORY TEST ---');

    // Load Keys
    const clientId = process.env.TWITCH_CLIENT_ID;
    const clientSecret = process.env.TWITCH_CLIENT_SECRET;

    if (!clientId || !clientSecret) return console.error('Missing Keys');

    // Get Token
    const authUrl = `https://id.twitch.tv/oauth2/token?client_id=${clientId}&client_secret=${clientSecret}&grant_type=client_credentials`;
    const authRes = await fetch(authUrl, { method: 'POST' });
    const authData = await authRes.json();
    const token = authData.access_token;

    // Test: Fetch 5 Main Games (Category = 0)
    console.log('\n[1] Fetching 5 items where category = 0 (Main Game)...');
    const q1 = `fields name, category, slug; where category = 0; limit 5;`;

    await runSingleTest(q1, clientId, token, '[1] Category=0 Test');
}

async function runSingleTest(body: string, clientId: string, token: string, label: string) {
    try {
        const res = await fetch(`${IGDB_BASE_URL}/games`, {
            method: 'POST',
            headers: {
                'Client-ID': clientId,
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'text/plain'
            },
            body: body
        });

        if (!res.ok) {
            console.error(`❌ ${label} Failed: ${res.status} ${await res.text()}`);
        } else {
            const data = await res.json();
            console.log(`✅ ${label} Success: Returned ${data.length} items.`);
            if (data.length > 0) {
                console.log(`   Sample: ${JSON.stringify(data[0])}`);
            }
        }
    } catch (e: any) {
        console.error(`❌ ${label} Exception:`, e.message);
    }
}

run();
