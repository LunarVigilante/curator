import 'dotenv/config';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { ImageService } from '@/lib/services/image/imageService';
import { generateEmbedding, generateTags, ensureTags, sleep, aiLimiter } from '@/lib/harvesters/shared';
import { generateStructuredDescription, combineDescription } from '@/lib/ai/structured-description';
import { decrypt } from '@/lib/encryption';
import pLimit from 'p-limit';

// Config
const IGDB_BASE_URL = 'https://api.igdb.com/v4';
const STEAMGRIDDB_BASE_URL = 'https://www.steamgriddb.com/api/v2';
const START_YEAR = 2026;
const END_YEAR = 1980;
const CONCURRENCY = 4;
const PAGE_SIZE_IGDB = 500;

// Env / Config
let TWITCH_CLIENT_ID = process.env.TWITCH_CLIENT_ID;
let TWITCH_CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET;
let STEAMGRIDDB_API_KEY = process.env.STEAMGRIDDB_API_KEY;

const supabase = createServiceRoleClient();
const imageService = new ImageService('covers');
const limit = pLimit(CONCURRENCY);

// Types
interface TriageItem {
    id: string; // Supabase UUID
    isComplete: boolean;
}

// State
const triageMap = new Map<number, TriageItem>();
const titleMap = new Map<string, TriageItem>();
let accessToken: string | null = null;

// ============================================================================
// AUTHENTICATION
// ============================================================================

// ============================================================================
// CONFIG & AUTH
// ============================================================================

async function loadConfig() {
    const getSetting = async (key: string, envVar: string) => {
        // Try DB first
        const { data } = await supabase.from('system_settings').select('value').eq('key', key).single() as any;
        if (data?.value) return decrypt(data.value);
        // Fallback to Env
        return process.env[envVar];
    };

    TWITCH_CLIENT_ID = await getSetting('twitch_client_id', 'TWITCH_CLIENT_ID');
    TWITCH_CLIENT_SECRET = await getSetting('twitch_client_secret', 'TWITCH_CLIENT_SECRET');
    STEAMGRIDDB_API_KEY = await getSetting('steam_grid_api_key', 'STEAMGRIDDB_API_KEY');

    if (!TWITCH_CLIENT_ID || !TWITCH_CLIENT_SECRET || !STEAMGRIDDB_API_KEY) {
        console.error('❌ Missing API Keys (Check Admin Settings or .env)');
        console.error(`   Twitch ID: ${TWITCH_CLIENT_ID ? 'OK' : 'MISSING'}`);
        console.error(`   Twitch Secret: ${TWITCH_CLIENT_SECRET ? 'OK' : 'MISSING'}`);
        console.error(`   SteamGridDB: ${STEAMGRIDDB_API_KEY ? 'OK' : 'MISSING'}`);
        process.exit(1);
    }
}

async function getIgdbToken() {
    if (accessToken) return accessToken;

    try {
        const url = `https://id.twitch.tv/oauth2/token?client_id=${TWITCH_CLIENT_ID}&client_secret=${TWITCH_CLIENT_SECRET}&grant_type=client_credentials`;
        const res = await fetch(url, { method: 'POST' });
        const data = await res.json();

        if (!data.access_token) throw new Error('Failed to auth with Twitch/IGDB: ' + JSON.stringify(data));
        accessToken = data.access_token;
        return accessToken;
    } catch (e) {
        console.error('❌ Auth Error:', e);
        process.exit(1);
    }
}

// ============================================================================
// API HELPERS
// ============================================================================

async function fetchIgdbGames(year: number, offset: number = 0) {
    const token = await getIgdbToken();

    // Unix Timestamps for Year
    const startDate = new Date(`${year}-01-01`).getTime() / 1000;
    const endDate = new Date(`${year}-12-31`).getTime() / 1000;

    // IGDB "Apicalypse" Query
    // Ref: https://api-docs.igdb.com/#game
    const query = `
        fields name, summary, storyline, total_rating, total_rating_count,
               first_release_date, slug, status,
               involved_companies.company.name, involved_companies.developer, involved_companies.publisher,
               genres.name, themes.name, 
                cover.url,
               game_engines.name,
               platforms.name,
               websites.category, websites.url,
               game_modes.name,
               player_perspectives.name,
               videos.video_id,
               screenshots.url,
               franchises.name,
               dlcs;
        where first_release_date >= ${startDate} 
          & first_release_date <= ${endDate};
        sort first_release_date desc;
        limit ${PAGE_SIZE_IGDB};
        offset ${offset};
    `;

    // Log the first query of the loop to debug
    if (offset === 0) {
        console.log(`\n   🔎 Querying Year ${year}: date >= ${startDate}, <= ${endDate}`);
        // console.log(query); // Uncomment for full query dump
    }

    const res = await fetch(`${IGDB_BASE_URL}/games`, {
        method: 'POST',
        headers: {
            'Client-ID': TWITCH_CLIENT_ID!,
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'text/plain'
        },
        body: query
    });

    if (!res.ok) {
        if (res.status === 429) {
            console.warn('   ⚠️ IGDB Rate Limit. Sleeping 1s...');
            await sleep(1000);
            return fetchIgdbGames(year, offset);
        }
        const errorText = await res.text();
        console.error('IGDB Raw Error:', errorText);
        throw new Error(`IGDB Error: ${res.status} ${res.statusText} - ${errorText}`);
    }

    const games = await res.json();
    if (offset === 0) console.log(`   🔙 IGDB returned ${games.length} items for offset 0.`);

    if (!games.length) return [];

    // Fetch TimeToBeat separately (since it's a separate endpoint/structure often tricky to expand directly on some plans/versions, 
    // or simply to ensure we get it right given previous error). 
    // Actually, TimeToBeat IS a separate endpoint in IGDB V4 if not expanded, but the expand field name is 'time_to_beat'? 
    // The user got 'Invalid field time_to_beat.normally'. The field is just 'time_to_beat' which is an ID, unless expanded. 
    // Let's try separate query to be safe and join in memory.

    // Extract IDs
    const gameIds = games.map((g: any) => g.id).join(',');

    try {
        // Query /time_to_beats endpoint
        const ttbRes = await fetch(`${IGDB_BASE_URL}/time_to_beats`, {
            method: 'POST',
            headers: {
                'Client-ID': TWITCH_CLIENT_ID!,
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'text/plain'
            },
            body: `fields game, normally, completely; where game = (${gameIds}); limit 100;`
        });

        if (ttbRes.ok) {
            const ttbData = await ttbRes.json();
            // Map TTB back to games
            games.forEach((game: any) => {
                const ttb = ttbData.find((t: any) => t.game === game.id);
                if (ttb) game.time_to_beat = ttb;
            });
        }
    } catch (e) {
        console.warn('   ⚠️ Failed to fetch TimeToBeat:', e);
    }

    return games;
}

async function fetchSteamGridVisuals(gameName: string, igdbId: number) {
    // 1. Search for Game ID on SteamGridDB
    // We try name first. We can't rely on IGDB ID directly mapping to SGDB ID.
    const searchUrl = `${STEAMGRIDDB_BASE_URL}/search/autocomplete/${encodeURIComponent(gameName)}`;
    const searchRes = await fetch(searchUrl, {
        headers: { 'Authorization': `Bearer ${STEAMGRIDDB_API_KEY}` }
    });

    if (!searchRes.ok) return null;
    const searchData = await searchRes.json();

    if (!searchData.data || searchData.data.length === 0) return null;
    const sgdbId = searchData.data[0].id; // Best match

    // 2. Fetch Assets (Grids, Heroes, Logos)
    // Run in parallel
    const headers = { 'Authorization': `Bearer ${STEAMGRIDDB_API_KEY}` };
    const [gridsRes, heroesRes, logosRes] = await Promise.all([
        fetch(`${STEAMGRIDDB_BASE_URL}/grids/game/${sgdbId}?styles=alternate&dimensions=600x900`, { headers }),
        fetch(`${STEAMGRIDDB_BASE_URL}/heroes/game/${sgdbId}?dimensions=1920x1080`, { headers }),
        fetch(`${STEAMGRIDDB_BASE_URL}/logos/game/${sgdbId}`, { headers })
    ]);

    const grids = await gridsRes.json();
    const heroes = await heroesRes.json();
    const logos = await logosRes.json();

    return {
        logo: logos.data?.[0]?.url || null
    };
}

// Helper to transform IGDB image URLs
function transformIgdbImage(url: string | undefined, size: 't_logo_med' | 't_thumb' | 't_1080p' | 't_screenshot_huge' | 't_original' = 't_1080p') {
    if (!url) return null;
    let clean = url.startsWith('//') ? `https:${url}` : url;
    return clean.replace('t_thumb', size);
}

// ============================================================================
// MAIN PROCESSOR
// ============================================================================

async function processTask(task: any) {
    const game = task.game;
    const igdbId = game.id;
    const title = game.name;

    // 1. EXTRACT DATA
    const developers = game.involved_companies
        ?.filter((c: any) => c.developer)
        .map((c: any) => c.company.name) || [];

    const publishers = game.involved_companies
        ?.filter((c: any) => c.publisher)
        .map((c: any) => c.company.name) || [];

    const genres = game.genres?.map((g: any) => g.name) || [];
    const themes = game.themes?.map((t: any) => t.name) || [];
    // Combine genres and themes for tags
    const keywords = [...new Set([...genres, ...themes])];

    const releaseDate = game.first_release_date ? new Date(game.first_release_date * 1000) : null;
    const releaseYear = releaseDate ? releaseDate.getFullYear() : null;

    // 4. MAP RICH METADATA
    const gameEngines = game.game_engines?.map((e: any) => ({
        name: e.name,
        logo: transformIgdbImage(e.logo?.url, 't_logo_med')
    })) || [];

    const platforms = game.platforms?.map((p: any) => ({
        name: p.name,
        logo: transformIgdbImage(p.platform_logo?.url, 't_logo_med')
    })) || [];

    // Extract platform names as simple string array for root column
    const platformNames: string[] = game.platforms?.map((p: any) => p.name) || [];

    // Map website categories: 1=official, 13=steam, 17=twitch, etc.
    const WEBSITE_CATEGORY_MAP: Record<number, string> = {
        1: 'official', 3: 'wikipedia', 5: 'twitter', 6: 'twitch',
        8: 'instagram', 9: 'youtube', 13: 'steam', 14: 'reddit',
        15: 'itch', 16: 'epic', 17: 'gog', 18: 'discord'
    };

    // Transform websites into key-value map for JSONB
    const websiteMap: Record<string, string> = {};
    game.websites?.forEach((w: any) => {
        const cat = WEBSITE_CATEGORY_MAP[w.category] || 'other';
        if (!websiteMap[cat]) websiteMap[cat] = w.url;
    });

    const videos = game.videos?.map((v: any) => `https://www.youtube.com/watch?v=${v.video_id}`) || [];
    const screenshots = game.screenshots?.map((s: any) => transformIgdbImage(s.url, 't_screenshot_huge')) || [];
    const gameModes = game.game_modes?.map((gm: any) => gm.name) || [];
    const perspectives = game.player_perspectives?.map((pp: any) => pp.name) || [];
    const franchise = game.franchises?.[0]?.name || null;
    const dlcCount = game.dlcs?.length || 0;

    // Status mapping (0=Released, 2=Alpha, 3=Beta, 4=Early Access, 5=Offline, 6=Cancelled, 7=Rumored)
    const STATUS_MAP: Record<number, string> = {
        0: 'Released', 2: 'Alpha', 3: 'Beta', 4: 'Early Access', 5: 'Offline', 6: 'Cancelled', 7: 'Rumored'
    };
    const gameStatus = STATUS_MAP[game.status] || 'Released';

    try {
        // ============================================
        // SCENARIO A: NEW ITEM
        // ============================================
        if (task.type === 'NEW') {
            console.log(`\n   ╔════════════════════════════════════════════════════════════════`);
            console.log(`   ║ 🎮 NEW GAME: ${title}`);
            console.log(`   ╠════════════════════════════════════════════════════════════════`);
            console.log(`   ║ IGDB ID: ${igdbId}`);
            console.log(`   ║ Year: ${releaseYear || 'N/A'}`);
            console.log(`   ╟────────────────────────────────────────────────────────────────`);
            console.log(`   ║ 📊 METADATA COLLECTED:`);
            console.log(`   ║    Developers: ${developers.slice(0, 2).join(', ') || 'N/A'}`);
            console.log(`   ║    Publishers: ${publishers.slice(0, 2).join(', ') || 'N/A'}`);
            console.log(`   ║    Genres: ${genres.slice(0, 5).join(', ') || 'N/A'}`);
            console.log(`   ║    Themes: ${themes.slice(0, 5).join(', ') || 'N/A'}`);
            console.log(`   ║    Platforms: ${platforms.slice(0, 3).map((p: any) => p.name).join(', ') || 'N/A'}`);
            console.log(`   ║    Game Modes: ${gameModes.slice(0, 3).join(', ') || 'N/A'}`);
            console.log(`   ║    Rating: ${game.total_rating ? (game.total_rating / 10).toFixed(1) : 'N/A'}`);
            console.log(`   ║    Status: ${gameStatus}`);
            console.log(`   ╟────────────────────────────────────────────────────────────────`);

            // 2. VISUALS
            console.log(`   ║ 🖼️  FETCHING VISUALS from SteamGridDB...`);
            const visualAssets = await fetchSteamGridVisuals(title, igdbId);

            // Fallback to IGDB cover if SGDB fails
            let posterUrl = null;
            if (game.cover?.url) {
                posterUrl = transformIgdbImage(game.cover.url, 't_original');
            }

            console.log(`   ║ 🖼️  UPLOADING IMAGE...`);
            console.log(`   ║    Source: ${(posterUrl || 'N/A').toString().slice(0, 60)}...`);
            const startImg = Date.now();
            const hostedPoster = posterUrl ? await imageService.processAndUpload(posterUrl, 'game') : null;
            if (hostedPoster) {
                console.log(`   ║    ✅ Uploaded in ${Date.now() - startImg}ms`);
                console.log(`   ║    Dest: ${hostedPoster.slice(0, 60)}...`);
            } else {
                console.log(`   ║    ⚠️  Upload failed or no image`);
            }

            console.log(`   ╟────────────────────────────────────────────────────────────────`);
            console.log(`   ║ 🧠 GENERATING STRUCTURED DESCRIPTION...`);
            // RICH CONTEXT: Pass full details to help AI distinguish between remakes
            const originalDescription = `
Title: ${title} (${releaseYear || 'N/A'})
Developer: ${developers.join(', ') || 'N/A'}
Publisher: ${publishers.join(', ') || 'N/A'}
Genres: ${genres.join(', ')}
Platforms: ${platforms.map((p: any) => p.name).join(', ')}
Keywords: ${keywords.join(', ')}
Overview: ${game.summary || game.storyline || 'N/A'}
            `.trim();

            const startDesc = Date.now();
            const description_parts = await aiLimiter(() => generateStructuredDescription(supabase, {
                title,
                originalDescription,
                type: 'Video Game',
                metadata: { genres, platforms: platforms.map((p: any) => p.name), developers }
            }));
            const aiDesc = combineDescription(description_parts);
            console.log(`   ║    ✅ Generated in ${Date.now() - startDesc}ms`);
            console.log(`   ║    Premise: ${(description_parts.premise || '').slice(0, 60)}...`);

            console.log(`   ╟────────────────────────────────────────────────────────────────`);
            console.log(`   ║ 🏷️  GENERATING TAGS...`);
            const contextString = `${aiDesc} Genre: ${genres.join(',')} Themes: ${themes.join(',')}`;
            const startTags = Date.now();
            const aiTags = await aiLimiter(() => generateTags(supabase, title, contextString, 'GAME'));
            const validTags = await ensureTags(supabase, aiTags);
            console.log(`   ║    ✅ Generated ${aiTags.length} tags in ${Date.now() - startTags}ms`);
            console.log(`   ║    Tags: ${aiTags.slice(0, 8).join(', ')}`);

            // Vector Text
            console.log(`   ╟────────────────────────────────────────────────────────────────`);
            console.log(`   ║ 🧮 GENERATING EMBEDDING...`);
            const vectorText = `
                Title: ${title}
                Developer: ${developers.join(', ')}
                Publisher: ${publishers.join(', ')}
                Genres: ${keywords.join(', ')}
                Plot: ${aiDesc}
            `.trim();
            console.log(`   ║    Vector text length: ${vectorText.length} chars`);
            const startEmbed = Date.now();
            const embedding = await generateEmbedding(vectorText);
            if (embedding) {
                console.log(`   ║    ✅ Embedding generated in ${Date.now() - startEmbed}ms (${embedding.length} dimensions)`);
            } else {
                console.log(`   ║    ⚠️  No embedding generated`);
            }

            // 4. INSERT
            console.log(`   ╟────────────────────────────────────────────────────────────────`);
            console.log(`   ║ 💾 SAVING TO DATABASE...`);
            const payload = {
                title: title,
                description: aiDesc,
                description_parts,
                category_type: 'VIDEO_GAME', // Normalized

                release_year: releaseYear,
                release_date: releaseDate?.toISOString(),

                vote_average: game.total_rating ? game.total_rating / 10 : null, // 0-100 -> 0-10
                vote_count: game.total_rating_count,

                developers: developers,
                publishers: publishers,
                genres: genres,
                keywords: keywords,

                time_to_beat: game.time_to_beat ? {
                    main: Math.round(game.time_to_beat.normally / 3600),
                    completionist: Math.round(game.time_to_beat.completely / 3600)
                } : null,

                external_ids: {
                    igdb: igdbId,
                    slug: game.slug
                },

                image_url: hostedPoster,
                logo_path: visualAssets?.logo || null,
                backdrop_path: screenshots[0] || null,

                cached_tags: validTags,
                vector_text: JSON.stringify(embedding),
                platforms: platformNames, // NEW: Root column text[]
                last_metadata_update: new Date().toISOString()
            };

            const { error } = await supabase.from('global_items').insert(payload as any);
            if (error) {
                if (error.code === '23505') {
                    console.log(`   ║ ⏭️  Already exists (Constraint)`);
                } else {
                    console.log(`   ║ ❌ DB ERROR: ${error.message}`);
                }
            } else {
                console.log(`   ║ ✅ SAVED SUCCESSFULLY`);
            }
            console.log(`   ╚════════════════════════════════════════════════════════════════\n`);
            triageMap.set(igdbId, { id: 'new-id', isComplete: true });

        }
        // ============================================
        // SCENARIO B: HEAL (Update Metadata)
        // ============================================
        else if (task.type === 'HEAL') {
            console.log(`\n   ╔════════════════════════════════════════════════════════════════`);
            console.log(`   ║ 🔧 HEAL GAME: ${title}`);
            console.log(`   ╠════════════════════════════════════════════════════════════════`);
            console.log(`   ║ IGDB ID: ${igdbId}`);
            console.log(`   ║ DB ID: ${task.id}`);
            console.log(`   ║ Year: ${releaseYear || 'N/A'}`);
            console.log(`   ╟────────────────────────────────────────────────────────────────`);
            console.log(`   ║ 📊 UPDATING METADATA:`);
            console.log(`   ║    Developers: ${developers.slice(0, 2).join(', ') || 'N/A'}`);
            console.log(`   ║    Publishers: ${publishers.slice(0, 2).join(', ') || 'N/A'}`);
            console.log(`   ║    Genres: ${genres.slice(0, 5).join(', ') || 'N/A'}`);
            console.log(`   ╟────────────────────────────────────────────────────────────────`);

            // We only update specific fields to avoid overwriting custom descriptions/images unless essential
            // Here we update the new columns primarily
            console.log(`   ║ 🖼️  FETCHING VISUALS from SteamGridDB...`);
            const visualAssets = await fetchSteamGridVisuals(title, igdbId);

            // Regenerate embedding with updated metadata
            console.log(`   ║ 🧮 REGENERATING EMBEDDING...`);
            const vectorText = `
                Title: ${title}
                Developer: ${developers.join(', ')}
                Publisher: ${publishers.join(', ')}
                Genres: ${keywords.join(', ')}
                Platforms: ${platforms.map((p: any) => p.name).join(', ')}
            `.trim();
            console.log(`   ║    Vector text length: ${vectorText.length} chars`);
            const startEmbed = Date.now();
            const embedding = await generateEmbedding(vectorText);
            if (embedding) {
                console.log(`   ║    ✅ Embedding generated in ${Date.now() - startEmbed}ms (${embedding.length} dimensions)`);
            } else {
                console.log(`   ║    ⚠️  No embedding generated`);
            }

            console.log(`   ║ 💾 SAVING TO DATABASE...`);
            const updatePayload = {
                external_ids: { igdb: igdbId, slug: game.slug }, // Ensure ID is set
                developers: developers,
                publishers: publishers,
                time_to_beat: game.time_to_beat ? {
                    main: Math.round(game.time_to_beat.normally / 3600),
                    completionist: Math.round(game.time_to_beat.completely / 3600)
                } : null,
                // Refresh Visuals if we have better ones
                logo_path: visualAssets?.logo || null,
                backdrop_path: screenshots[0] || null,
                // Update embedding
                vector_text: embedding ? JSON.stringify(embedding) : undefined,
                platforms: platformNames, // NEW: Root column text[]

                last_metadata_update: new Date().toISOString()
            };

            const { error } = await (supabase.from('global_items') as any).update(updatePayload).eq('id', task.id);

            if (error) {
                console.log(`   ║ ❌ DB ERROR: ${error.message}`);
            } else {
                console.log(`   ║ ✅ HEALED SUCCESSFULLY`);
            }
            console.log(`   ╚════════════════════════════════════════════════════════════════\n`);
            triageMap.set(igdbId, { id: task.id, isComplete: true });
        }

    } catch (error) {
        console.error(`     ❌ Failed processing ${title}:`, error);
    }
}

// ============================================================================
// MAIN LOOP
// ============================================================================

async function startHarvest() {
    await loadConfig();
    console.log(`🚀 STARTING SMART GAME HARVEST (IGDB + SteamGridDB)`);
    console.log(`   📅 Years: ${START_YEAR} -> ${END_YEAR}`);
    console.log(`   ⚡ Concurrency: ${CONCURRENCY}`);

    // 1. Build Triage Map
    console.log(`\n📥 Building Triage Map from DB...`);

    // We fetch VIDEO_GAME and BOARD_GAME (just in case) but filter for VIDEO_GAME primarily
    // Older scripts might have used 'VIDEO_GAME' or 'video_game'
    const existingItems: any[] = [];
    const PAGE_SIZE_DB = 1000;
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
        const { data, error } = await supabase
            .from('global_items')
            .select('id, title, external_ids, category_type')
            .eq('category_type', 'VIDEO_GAME') // Ensure we match the Normalized type
            .range(offset, offset + PAGE_SIZE_DB - 1);

        if (error) {
            console.error('❌ Failed to load existing items:', error);
            process.exit(1);
        }

        if (data && data.length > 0) {
            existingItems.push(...data);
            offset += PAGE_SIZE_DB;
            hasMore = data.length === PAGE_SIZE_DB;
            process.stdout.write(`\r   📦 Loaded ${existingItems.length} items...`);
        } else {
            hasMore = false;
        }
    }
    console.log('');

    existingItems.forEach((row: any) => {
        const isComplete = true; // Assume complete if exists for now
        const triageItem = { id: row.id, isComplete };

        if (row.external_ids?.igdb) {
            triageMap.set(Number(row.external_ids.igdb), triageItem);
        }
        if (row.title) {
            titleMap.set(`${row.title.toLowerCase()}|VIDEO_GAME`, triageItem);
        }
    });

    console.log(`   ✅ Loaded ${existingItems.length} items to triage.`);

    // 2. Iterate Years
    for (let year = START_YEAR; year >= END_YEAR; year--) {
        console.log(`\n📅 Processing Year: ${year}`);
        let offset = 0;

        while (true) {
            try {
                const games = await fetchIgdbGames(year, offset);
                if (!games || games.length === 0) break;

                const batch = games.map((game: any) => {
                    const titleKey = `${game.name.toLowerCase()}|VIDEO_GAME`;
                    let status = triageMap.get(game.id); // Check IGDB ID

                    if (!status) status = titleMap.get(titleKey); // Check Title

                    if (!status) return { type: 'NEW', game };
                    // We can add a check for 'completeness' (e.g. missing new columns) to trigger HEAL
                    // For now, let's treat existing as SKIP unless we force healing
                    return { type: 'SKIP', game, id: status.id };
                });

                const newCount = batch.filter((b: any) => b.type === 'NEW').length;
                const healCount = batch.filter((b: any) => b.type === 'HEAL').length;
                const skipCount = batch.filter((b: any) => b.type === 'SKIP').length;

                process.stdout.write(`   📄 Offset ${offset}: ${newCount} New, ${skipCount} Skip\r`);

                const tasks = batch.map((task: any) => limit(async () => {
                    if (task.type === 'SKIP') return;
                    await processTask(task);
                }));

                await Promise.all(tasks);

                offset += PAGE_SIZE_IGDB;
                await sleep(250); // Respect rate limit (4 req/s)

            } catch (err) {
                console.error(`   ❌ Failed Year ${year} Offset ${offset}:`, err);
                await sleep(5000);
            }
        }
        console.log(''); // New Item
    }
    console.log('\n✅ SMART HARVEST COMPLETE');
}

startHarvest().catch(console.error);
