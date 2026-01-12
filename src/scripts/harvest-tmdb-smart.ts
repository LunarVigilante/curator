import 'dotenv/config';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { ImageService } from '@/lib/services/image/imageService';
import { rewriteDescription, generateEmbedding, generateTags, ensureTags, sleep, aiLimiter } from '@/lib/harvesters/shared';
import pLimit from 'p-limit';

// Config
const START_YEAR = 2026;
const END_YEAR = 1970;
const MAX_PAGES = 100;
const CONCURRENCY = 5;
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const OMDB_BASE_URL = 'https://www.omdbapi.com';
const TMDB_API_KEY = process.env.TMDB_API_KEY;
const OMDB_API_KEY = process.env.OMDB_API_KEY;

// CLI Args
const args = process.argv.slice(2);
const typeArg = args.find(a => a.startsWith('--type='))?.split('=')[1];
const TYPE: 'movie' | 'tv' = (typeArg === 'tv' ? 'tv' : 'movie');

if (!TMDB_API_KEY) {
    console.error('❌ Missing TMDB_API_KEY');
    process.exit(1);
}

if (!OMDB_API_KEY) {
    console.warn('⚠️  Missing OMDB_API_KEY. Ratings and improved metadata will be skipped.');
}

const supabase = createServiceRoleClient();
const imageService = new ImageService('covers');
const limit = pLimit(CONCURRENCY);

// Types
interface TriageItem {
    id: string; // Supabase UUID
    isComplete: boolean;
}

const triageMap = new Map<number, TriageItem>();
const titleMap = new Map<string, TriageItem>();

// ============================================================================
// HELPERS
// ============================================================================

async function fetchTmdbDiscover(year: number, page: number) {
    const sort = 'vote_count.desc';
    const yearParam = TYPE === 'movie' ? `primary_release_year=${year}` : `first_air_date_year=${year}`;
    const url = `${TMDB_BASE_URL}/discover/${TYPE}?api_key=${TMDB_API_KEY}&sort_by=${sort}&page=${page}&${yearParam}&include_adult=false&vote_count.gte=10`;

    const res = await fetch(url);
    if (!res.ok) {
        if (res.status === 429) {
            console.warn('   ⚠️ Rate limited (Discover). Sleeping 5s...');
            await sleep(5000);
            return fetchTmdbDiscover(year, page);
        }
        throw new Error(`Data Fetch Error ${res.status}`);
    }
    return await res.json();
}

async function fetchTmdbDetails(tmdbId: number) {
    const commonAppend = 'credits,videos,images,external_ids,keywords,watch/providers,recommendations';
    const append = TYPE === 'movie'
        ? `${commonAppend},release_dates`
        : `${commonAppend},content_ratings`;

    const url = `${TMDB_BASE_URL}/${TYPE}/${tmdbId}?api_key=${TMDB_API_KEY}&append_to_response=${append}`;

    const res = await fetch(url);
    if (!res.ok) {
        if (res.status === 429) {
            console.warn('   ⚠️ Rate limited (Details). Sleeping 5s...');
            await sleep(5000);
            return fetchTmdbDetails(tmdbId);
        }
        if (res.status === 404) return null;
        throw new Error(`Details Fetch Error ${res.status}`);
    }
    return await res.json();
}

async function fetchOmdbData(imdbId: string) {
    if (!OMDB_API_KEY || !imdbId) return null;

    // We use the 'i' param for ID lookup, and request full plot just in case (though we use TMDB/AI for that)
    // tomatoes=true is deprecated but sometimes still useful for legacy fields
    const url = `${OMDB_BASE_URL}/?apikey=${OMDB_API_KEY}&i=${imdbId}&tomatoes=true`;
    try {
        const res = await fetch(url);
        if (!res.ok) {
            console.warn(`   ⚠️ OMDb HTTP Error ${res.status} for ${imdbId}`);
            return null;
        }

        const data = await res.json();
        if (data.Response === 'False') {
            console.warn(`   ⚠️ OMDb API Error for ${imdbId}: ${data.Error}`);
            return null;
        }

        // Extract Rotten Tomatoes safely
        let rtScore: number | null = null;
        const rtSource = data.Ratings?.find((r: any) => r.Source === 'Rotten Tomatoes');
        if (rtSource && rtSource.Value) {
            rtScore = parseInt(rtSource.Value.replace('%', ''), 10);
        }

        return {
            // Ratings
            imdb_rating: data.imdbRating && data.imdbRating !== 'N/A' ? parseFloat(data.imdbRating) : null,
            imdb_votes: data.imdbVotes ? parseInt(data.imdbVotes.replace(/,/g, ''), 10) : null,
            rotten_tomatoes_rating: rtScore,
            metacritic_rating: data.Metascore && data.Metascore !== 'N/A' ? parseInt(data.Metascore, 10) : null,
            awards: data.Awards && data.Awards !== 'N/A' ? data.Awards : null,

            // Metadata to Swap/Add
            rated: data.Rated && data.Rated !== 'N/A' ? data.Rated : null, // e.g. "PG-13"
            writer: data.Writer && data.Writer !== 'N/A' ? data.Writer : null, // e.g. "J.R.R. Tolkien (novel), Peter Jackson (screenplay)"
            box_office: data.BoxOffice && data.BoxOffice !== 'N/A' ? data.BoxOffice : null, // e.g. "$377,845,905"
        };
    } catch (e: any) {
        console.warn(`   ⚠️ OMDb Exception for ${imdbId}:`, e.message);
        return null;
    }
}

async function fetchOmdbDataByTitle(title: string, year: number) {
    if (!OMDB_API_KEY) return null;
    const url = `${OMDB_BASE_URL}/?apikey=${OMDB_API_KEY}&t=${encodeURIComponent(title)}&y=${year}&tomatoes=true`;
    try {
        const res = await fetch(url);
        if (!res.ok) return null;
        const data = await res.json();
        if (data.Response === 'False') return null;

        // Extract Rotten Tomatoes safely
        let rtScore: number | null = null;
        const rtSource = data.Ratings?.find((r: any) => r.Source === 'Rotten Tomatoes');
        if (rtSource && rtSource.Value) {
            rtScore = parseInt(rtSource.Value.replace('%', ''), 10);
        }

        return {
            // Ratings
            imdb_rating: data.imdbRating && data.imdbRating !== 'N/A' ? parseFloat(data.imdbRating) : null,
            imdb_votes: data.imdbVotes ? parseInt(data.imdbVotes.replace(/,/g, ''), 10) : null,
            rotten_tomatoes_rating: rtScore,
            metacritic_rating: data.Metascore && data.Metascore !== 'N/A' ? parseInt(data.Metascore, 10) : null,
            awards: data.Awards && data.Awards !== 'N/A' ? data.Awards : null,

            // Metadata to Swap/Add
            rated: data.Rated && data.Rated !== 'N/A' ? data.Rated : null, // e.g. "PG-13"
            writer: data.Writer && data.Writer !== 'N/A' ? data.Writer : null, // e.g. "J.R.R. Tolkien (novel), Peter Jackson (screenplay)"
            box_office: data.BoxOffice && data.BoxOffice !== 'N/A' ? data.BoxOffice : null, // e.g. "$377,845,905"
        };
    } catch (e) {
        return null;
    }
}

// ============================================================================
// EXTRACTION LOGIC
// ============================================================================

function extractMetadata(details: any) {
    // TMDB Base Data
    const cast = details.credits?.cast?.slice(0, 10).map((c: any) => c.name) || [];
    const crew = details.credits?.crew || [];
    const director = crew.find((c: any) => c.job === 'Director')?.name || null;

    // Default TMDB Writers (Fallback)
    const writers = crew.filter((c: any) => ['Screenplay', 'Writer', 'Story'].includes(c.job)).map((c: any) => c.name);
    const tmdbWriter = [...new Set(writers)].slice(0, 3).join(', ') || null;

    const studios = details.production_companies?.map((c: any) => c.name) || [];
    const mainStudio = studios[0] || null;

    // Default TMDB Rating (Fallback)
    let tmdbRating = null;
    if (TYPE === 'movie') {
        const usRelease = details.release_dates?.results?.find((r: any) => r.iso_3166_1 === 'US');
        if (usRelease) {
            const cert = usRelease.release_dates.find((d: any) => d.certification);
            tmdbRating = cert?.certification || null;
        }
    } else {
        const usRating = details.content_ratings?.results?.find((r: any) => r.iso_3166_1 === 'US');
        tmdbRating = usRating?.rating || null;
    }

    const videos = details.videos?.results || [];
    const trailer = videos.find((v: any) => v.site === 'YouTube' && v.type === 'Trailer');
    const trailerUrl = trailer ? `https://www.youtube.com/watch?v=${trailer.key}` : null;

    const backdropPath = details.images?.backdrops?.[0]?.file_path || null;
    const logoPath = details.images?.logos?.find((l: any) => l.iso_639_1 === 'en')?.file_path || null;
    const keywords = details.keywords?.results?.map((k: any) => k.name) || details.keywords?.keywords?.map((k: any) => k.name) || [];
    const socials = details.external_ids || {};
    const watchProviders = details['watch/providers']?.results?.US || null;

    return {
        title: details.title || details.name,
        original_title: details.original_title || details.original_name,
        overview: details.overview,
        tagline: details.tagline || null,
        release_date: details.release_date || details.first_air_date,
        release_year: new Date(details.release_date || details.first_air_date || new Date().toISOString()).getFullYear(),
        status: details.status,
        homepage: details.homepage,
        poster_path: details.poster_path,
        backdrop_path: backdropPath,
        logo_path: logoPath,
        trailer_url: trailerUrl,
        popularity: details.popularity,
        vote_average: details.vote_average,
        vote_count: details.vote_count,
        budget: details.budget || 0,
        revenue: details.revenue || 0,
        runtime: details.runtime || (details.episode_run_time?.length ? details.episode_run_time[0] : 0),

        // Fallbacks (will be overwritten by OMDb if available)
        content_rating: tmdbRating,
        writer: tmdbWriter,

        genres: details.genres?.map((g: any) => g.name) || [],
        keywords: keywords,
        original_language: details.original_language,
        origin_countries: details.origin_country || (details.production_countries?.map((c: any) => c.iso_3166_1) || []),
        spoken_languages: details.spoken_languages?.map((l: any) => l.english_name) || [],
        cast: cast,
        director: director,
        studio: mainStudio,
        production_companies: studios,
        networks: details.networks?.map((n: any) => n.name) || [],
        number_of_seasons: details.number_of_seasons || null,
        number_of_episodes: details.number_of_episodes || null,
        external_ids: {
            imdb: socials.imdb_id,
            tmdb: details.id,
            wikidata: socials.wikidata_id,
            facebook: socials.facebook_id,
            instagram: socials.instagram_id,
            twitter: socials.twitter_id,
        },
        watch_providers: watchProviders,
    };
}

// ============================================================================
// MAIN LOOP
// ============================================================================

async function startHarvest() {
    console.log(`🚀 STARTING HARVEST (${TYPE.toUpperCase()}) WITH OMDb SWAP`);

    // 1. Build Triage Map
    console.log(`\n📥 Building Triage Map...`);

    const categoryType = TYPE === 'movie' ? 'MOVIE' : 'TV_SHOW';
    const existingItems: any[] = [];
    const PAGE_SIZE = 1000;
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
        const { data, error } = await supabase
            .from('global_items')
            .select('id, title, external_ids, category_type')
            .eq('category_type', categoryType)
            .range(offset, offset + PAGE_SIZE - 1);

        if (error) {
            console.error('❌ Failed to load existing items:', error);
            process.exit(1);
        }

        if (data && data.length > 0) {
            existingItems.push(...data);
            offset += PAGE_SIZE;
            hasMore = data.length === PAGE_SIZE;
            process.stdout.write(`\r   📦 Loaded ${existingItems.length} items...`);
        } else {
            hasMore = false;
        }
    }
    console.log('');

    existingItems.forEach((row: any) => {
        const triageItem = { id: row.id, isComplete: true };
        const tmdbId = row.external_ids?.tmdb || row.external_ids?.tmdb_tv;
        if (tmdbId) triageMap.set(Number(tmdbId), triageItem);
        if (row.title) {
            const titleKey = `${row.title.toLowerCase()}|${row.category_type}`;
            titleMap.set(titleKey, triageItem);
        }
    });

    // 2. Iterate Years
    for (let year = START_YEAR; year >= END_YEAR; year--) {
        console.log(`\n📅 Processing Year: ${year}`);

        for (let page = 1; page <= MAX_PAGES; page++) {
            try {
                const data = await fetchTmdbDiscover(year, page);
                const results = data.results || [];
                if (results.length === 0) break;

                const batch = results.map((item: any) => {
                    const title = item.title || item.name;
                    const titleKey = `${title.toLowerCase()}|${categoryType}`;

                    let status = triageMap.get(item.id);
                    if (!status) status = titleMap.get(titleKey);

                    if (!status) return { type: 'NEW', item };
                    return { type: 'HEAL', item, id: status.id };
                });

                const newCount = batch.filter((b: any) => b.type === 'NEW').length;
                const healCount = batch.filter((b: any) => b.type === 'HEAL').length;

                if (newCount === 0 && healCount === 0) {
                    process.stdout.write('.');
                    continue;
                }

                console.log(`   📄 Year ${year} Page ${page}: ${newCount} New, ${healCount} Update`);

                const tasks = batch.map((task: any) => limit(async () => {
                    await processTask(task);
                }));

                await Promise.all(tasks);
                await sleep(250);

            } catch (err) {
                console.error(`   ❌ Failed Year ${year} Page ${page}:`, err);
                await sleep(1000);
            }
        }
    }
    console.log('\n✅ HARVEST COMPLETE');
}

async function processTask(task: any) {
    const tmdbId = task.item.id;
    const title = task.item.title || task.item.name;

    try {
        const details = await fetchTmdbDetails(tmdbId);
        if (!details) return;

        const meta = extractMetadata(details);
        const categoryType = TYPE === 'movie' ? 'MOVIE' : 'TV_SHOW';

        console.log(`\n   ╔════════════════════════════════════════════════════════════════`);
        console.log(`   ║ 🎬 ${task.type === 'NEW' ? 'NEW' : 'UPDATE'} ${TYPE.toUpperCase()}: ${meta.title}`);
        console.log(`   ╠════════════════════════════════════════════════════════════════`);
        console.log(`   ║ TMDB ID: ${tmdbId}`);
        console.log(`   ║ IMDB ID: ${meta.external_ids.imdb || 'N/A'}`);
        console.log(`   ║ Year: ${meta.release_year || 'N/A'}`);
        console.log(`   ╟────────────────────────────────────────────────────────────────`);
        console.log(`   ║ 📊 METADATA COLLECTED:`);
        console.log(`   ║    Director: ${meta.director || 'N/A'}`);
        console.log(`   ║    Writer: ${meta.writer || 'N/A'}`);
        console.log(`   ║    Studio: ${meta.studio || 'N/A'}`);
        console.log(`   ║    Runtime: ${meta.runtime || 'N/A'} min`);
        console.log(`   ║    Status: ${meta.status || 'N/A'}`);
        console.log(`   ║    Genres: ${meta.genres.slice(0, 5).join(', ') || 'N/A'}`);
        console.log(`   ║    Cast: ${meta.cast.slice(0, 3).join(', ') || 'N/A'}`);
        console.log(`   ║    Rating: ${meta.vote_average || 'N/A'} (${meta.vote_count} votes)`);
        if (TYPE === 'tv') {
            console.log(`   ║    Seasons: ${meta.number_of_seasons || 'N/A'}`);
            console.log(`   ║    Episodes: ${meta.number_of_episodes || 'N/A'}`);
        }
        console.log(`   ╟────────────────────────────────────────────────────────────────`);

        // ------------------------------------------
        // FETCH OMDb DATA
        // ------------------------------------------
        const imdbId = meta.external_ids.imdb;
        let omdbData = null;

        if (imdbId) {
            console.log(`   ║ 🎯 FETCHING OMDb DATA (ByID)...`);
            omdbData = await fetchOmdbData(imdbId);
        }

        if (!omdbData) {
            console.log(`   ║ 🎯 FETCHING OMDb DATA (ByTitle)...`);
            omdbData = await fetchOmdbDataByTitle(meta.title, meta.release_year);
        }

        if (omdbData) {
            console.log(`   ║    ✅ OMDb data retrieved`);
            console.log(`   ║    IMDB: ${omdbData.imdb_rating || 'N/A'} | RT: ${omdbData.rotten_tomatoes_rating || 'N/A'}% | MC: ${omdbData.metacritic_rating || 'N/A'}`);
        } else {
            console.log(`   ║    ⚠️  No OMDb data found`);
        }

        // ------------------------------------------
        // PREPARE PAYLOAD
        // ------------------------------------------

        // CHECK IF WE SHOULD PRESERVE EXISTING DESCRIPTION (For Updates)
        let preserveDescription = false;
        if (task.type !== 'NEW') {
            const { data: existing } = await supabase
                .from('global_items')
                .select('description_parts')
                .eq('id', task.id)
                .single();

            if ((existing as any)?.description_parts) {
                preserveDescription = true;
                console.log(`   ║ 🛡️  PRESERVING EXISTING STRUCTURED DESCRIPTION`);
            }
        }

        let imageUrl: string | null = null;
        if (task.type === 'NEW' && meta.poster_path) {
            console.log(`   ╟────────────────────────────────────────────────────────────────`);
            console.log(`   ║ 🖼️  UPLOADING IMAGE...`);
            const rawUrl = `https://image.tmdb.org/t/p/original${meta.poster_path}`;
            console.log(`   ║    Source: ${rawUrl.slice(0, 60)}...`);
            const startImg = Date.now();
            imageUrl = await imageService.processAndUpload(rawUrl, TYPE);
            if (imageUrl) {
                console.log(`   ║    ✅ Uploaded in ${Date.now() - startImg}ms`);
                console.log(`   ║    Dest: ${imageUrl.slice(0, 60)}...`);
            } else {
                console.log(`   ║    ⚠️  Upload failed`);
            }
        }

        // Prepare final fields (prefer OMDb if available)
        const finalWriter = omdbData?.writer || meta.writer;
        const finalContentRating = omdbData?.rated || meta.content_rating;
        const finalBoxOffice = omdbData?.box_office || null;

        let description = meta.overview;
        let validTags: { id: string, name: string }[] = [];
        let embeddingVector = null;

        if (task.type === 'NEW') {
            console.log(`   ╟────────────────────────────────────────────────────────────────`);
            console.log(`   ║ 🧠 GENERATING AI DESCRIPTION...`);
            console.log(`   ║    Original: ${(meta.overview || '').slice(0, 80)}...`);
            // RICH CONTEXT: Pass full details to help AI distinguish between remakes (e.g. Lilo & Stitch 2002 vs 2025)
            const richContext = `
Title: ${meta.title} (${meta.release_year})
Director: ${meta.director || 'N/A'}
Writer: ${finalWriter || 'N/A'}
Cast: ${meta.cast.slice(0, 5).join(', ')}
Genres: ${meta.genres.join(', ')}
Keywords: ${meta.keywords.join(', ')}
Overview: ${meta.overview || 'N/A'}
            `.trim();

            const startDesc = Date.now();
            description = await aiLimiter(() =>
                rewriteDescription(supabase, meta.title, richContext, categoryType)
            );
            console.log(`   ║    ✅ Generated in ${Date.now() - startDesc}ms`);
            console.log(`   ║    Result: ${description.slice(0, 80)}...`);

            console.log(`   ╟────────────────────────────────────────────────────────────────`);
            console.log(`   ║ 🏷️  GENERATING TAGS...`);
            const tagInput = [...(meta.keywords || []), ...meta.genres].join(', ');
            const startTags = Date.now();
            const aiTagNames = await aiLimiter(() =>
                generateTags(supabase, meta.title, `${description} Keywords: ${tagInput}`, categoryType)
            );
            validTags = await ensureTags(supabase, aiTagNames);
            console.log(`   ║    ✅ Generated ${aiTagNames.length} tags in ${Date.now() - startTags}ms`);
            console.log(`   ║    Tags: ${aiTagNames.slice(0, 8).join(', ')}`);

            console.log(`   ╟────────────────────────────────────────────────────────────────`);
            console.log(`   ║ 🧮 GENERATING EMBEDDING...`);
            const vectorText = `
                Title: ${meta.title}
                Rating: ${omdbData?.rotten_tomatoes_rating || meta.vote_average}
                Director: ${meta.director || 'Unknown'}
                Writer: ${finalWriter || 'Unknown'}
                Keywords: ${meta.keywords.slice(0, 10).join(', ')}
                Plot: ${description}
            `.trim();
            console.log(`   ║    Vector text length: ${vectorText.length} chars`);
            const startEmbed = Date.now();
            embeddingVector = await generateEmbedding(vectorText);
            if (embeddingVector) {
                console.log(`   ║    ✅ Embedding generated in ${Date.now() - startEmbed}ms (${embeddingVector.length} dimensions)`);
            } else {
                console.log(`   ║    ⚠️  No embedding generated`);
            }
        }

        console.log(`   ╟────────────────────────────────────────────────────────────────`);
        console.log(`   ║ 💾 SAVING TO DATABASE...`);

        // ------------------------------------------
        // PREPARE PAYLOAD
        // ------------------------------------------

        // Base Metadata (Safe to update)
        const basePayload = {
            title: meta.title,
            category_type: categoryType,
            release_year: meta.release_year,
            runtime: meta.runtime,
            trailer_url: meta.trailer_url,
            tagline: meta.tagline,

            // PREFERRED OMDB FIELDS
            content_rating: finalContentRating,
            writer: finalWriter,
            box_office: finalBoxOffice,

            // TMDB Rating
            vote_average: meta.vote_average,

            // OMDb RATINGS & AWARDS
            imdb_rating: omdbData?.imdb_rating || null,
            imdb_votes: omdbData?.imdb_votes || null,
            rotten_tomatoes_rating: omdbData?.rotten_tomatoes_rating || null,
            metacritic_rating: omdbData?.metacritic_rating || null,
            awards_text: omdbData?.awards || null,

            // Extended Metadata
            original_title: meta.original_title,
            status: meta.status,
            homepage: meta.homepage,
            budget: meta.budget,
            revenue: meta.revenue,
            original_language: meta.original_language,
            spoken_languages: meta.spoken_languages,
            origin_countries: meta.origin_countries,
            cast: meta.cast,
            director: meta.director,
            studio: meta.studio,
            production_companies: meta.production_companies,
            networks: meta.networks,
            number_of_seasons: meta.number_of_seasons,
            number_of_episodes: meta.number_of_episodes,
            genres: meta.genres,
            keywords: meta.keywords,
            external_ids: meta.external_ids,
            watch_providers: meta.watch_providers,
            backdrop_path: meta.backdrop_path,
            logo_path: meta.logo_path,
            last_metadata_update: new Date().toISOString(),
        };

        if (task.type === 'NEW') {
            // ------------------------------------------
            // NEW ITEM: Add Description, Tags, Embeddings, Image
            // ------------------------------------------

            const insertPayload = {
                ...basePayload,
                description: description, // Calculated above
                image_url: imageUrl,      // Calculated above
                cached_tags: validTags,   // Calculated above
                vector_text: JSON.stringify(embeddingVector)
            };

            const { error } = await (supabase.from('global_items') as any).insert(insertPayload);
            if (error) {
                console.log(`   ║ ❌ DB ERROR: ${error.message}`);
            } else {
                console.log(`   ║ ✅ SAVED SUCCESSFULLY`);
            }
        } else {
            // ------------------------------------------
            // HEAL ITEM: Update Metadata Only (STRICT SAFETY)
            // ------------------------------------------
            // We do NOT update description, tags, or image_url
            // We do NOT update vector_text (unless we want to regen based on metadata, but user asked for strict safety)

            // STRICT SAFETY: Consciously exclude description/tags/image
            const updatePayload = { ...basePayload };
            delete (updatePayload as any).description;
            delete (updatePayload as any).description_parts;
            delete (updatePayload as any).cached_tags;
            delete (updatePayload as any).vector_text;
            delete (updatePayload as any).image_url;

            const { error } = await (supabase.from('global_items') as any).update(updatePayload).eq('id', task.id);
            if (error) {
                console.log(`   ║ ❌ DB ERROR: ${error.message}`);
            } else {
                console.log(`   ║ ✅ UPDATED SUCCESSFULLY`);
            }
        }
        console.log(`   ╚════════════════════════════════════════════════════════════════\n`);

        triageMap.set(tmdbId, { id: task.id || 'new-id', isComplete: true });

    } catch (error) {
        console.log(`   ║ ❌ PROCESSING ERROR: ${error}`);
        console.log(`   ╚════════════════════════════════════════════════════════════════\n`);
    }
}

startHarvest().catch(console.error);
