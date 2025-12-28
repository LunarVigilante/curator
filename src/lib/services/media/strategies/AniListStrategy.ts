import { MediaStrategy, MediaSearchResponse } from "../types";
import { SystemSettings } from '@/lib/services/SystemConfigService';

/**
 * Enhanced AniList Strategy for Anime & Manga
 * 
 * Uses AniList GraphQL API with comprehensive metadata:
 * - Anime: Studios (isMain), Directors, Airing Season, Episodes
 * - Manga: Authors, Chapters/Volumes, Country of Origin
 * - Both: Tags (with rank), Genres, Description, Average Score
 * 
 * No API key required - public API.
 */
export class AniListStrategy implements MediaStrategy {
    name = "Anime & Manga";

    // Can be 'ANIME' or 'MANGA'
    private mediaType: 'ANIME' | 'MANGA';

    constructor(mediaType: 'ANIME' | 'MANGA' = 'ANIME') {
        this.mediaType = mediaType;
    }

    async search(query: string, settings: SystemSettings): Promise<MediaSearchResponse> {
        const apiUrl = settings['anilist_api_url'] || 'https://graphql.anilist.co';

        // Comprehensive GraphQL query for both Anime and Manga
        const graphqlQuery = `
            query ($search: String, $type: MediaType) {
                Page(page: 1, perPage: 5) {
                    media(search: $search, type: $type, sort: POPULARITY_DESC) {
                        id
                        type
                        siteUrl
                        title {
                            english
                            romaji
                            native
                        }
                        coverImage {
                            extraLarge
                            large
                            color
                        }
                        bannerImage
                        description(asHtml: false)
                        format
                        status
                        averageScore
                        popularity
                        
                        startDate { year month day }
                        endDate { year month day }
                        season
                        seasonYear
                        
                        episodes
                        duration
                        chapters
                        volumes
                        
                        genres
                        countryOfOrigin
                        isAdult
                        
                        tags(limit: 15, sort: RANK_DESC) {
                            name
                            rank
                            category
                            isMediaSpoiler
                        }
                        
                        studios(isMain: true) {
                            nodes {
                                name
                            }
                        }
                        
                        staff(perPage: 5, sort: RELEVANCE) {
                            edges {
                                role
                                node {
                                    name {
                                        full
                                    }
                                }
                            }
                        }
                        
                        nextAiringEpisode {
                            airingAt
                            episode
                        }
                    }
                }
            }
        `;

        try {
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                },
                body: JSON.stringify({
                    query: graphqlQuery,
                    variables: {
                        search: query,
                        type: this.mediaType
                    }
                })
            });

            if (!response.ok) {
                return {
                    success: false,
                    data: [],
                    error: `AniList API Error: ${response.statusText}`
                };
            }

            const data = await response.json();

            if (data.errors) {
                return {
                    success: false,
                    data: [],
                    error: data.errors[0]?.message || 'AniList API Error'
                };
            }

            const mediaList = data.data?.Page?.media || [];

            const results = mediaList.map((item: any) => {
                // Get best title (prefer English, fall back to romaji)
                const title = item.title.english || item.title.romaji || item.title.native || 'Unknown';

                // Clean description (remove HTML tags and limit length)
                let description = item.description || '';
                description = description
                    .replace(/<br\s*\/?>/gi, ' ')
                    .replace(/<[^>]*>/g, '')
                    .replace(/\s+/g, ' ')
                    .trim()
                    .substring(0, 300);
                if (description.length === 300) description += '...';

                // Get year
                const year = item.startDate?.year?.toString() || '';

                // Get image (prefer extraLarge)
                const imageUrl = item.coverImage?.extraLarge || item.coverImage?.large || null;

                // Get studios (Anime-specific)
                const studios = item.studios?.nodes?.map((s: any) => s.name) || [];

                // Get staff with roles
                const staff = item.staff?.edges?.map((e: any) => ({
                    name: e.node?.name?.full || '',
                    role: e.role || ''
                })) || [];

                // Find director (Anime) or author/artist (Manga)
                let keyPerson = '';
                if (this.mediaType === 'ANIME') {
                    const director = staff.find((s: any) =>
                        s.role.toLowerCase().includes('director')
                    );
                    keyPerson = director?.name || '';
                } else {
                    const author = staff.find((s: any) =>
                        s.role.toLowerCase().includes('story') ||
                        s.role.toLowerCase().includes('art') ||
                        s.role.toLowerCase().includes('original creator')
                    );
                    keyPerson = author?.name || '';
                }

                // Get non-spoiler tags with high rank
                const tags = item.tags
                    ?.filter((t: any) => !t.isMediaSpoiler && t.rank >= 50)
                    ?.map((t: any) => t.name) || [];

                // Get genres
                const genres = item.genres || [];

                // Build context-aware description
                const descParts: string[] = [];

                if (this.mediaType === 'ANIME') {
                    // Anime: Studio, Episodes, Season
                    if (studios.length > 0) descParts.push(studios[0]);
                    if (item.episodes) descParts.push(`${item.episodes} eps`);
                    if (item.seasonYear && item.season) {
                        descParts.push(`${item.season} ${item.seasonYear}`);
                    }
                } else {
                    // Manga: Author, Chapters, Origin
                    if (keyPerson) descParts.push(`by ${keyPerson}`);
                    if (item.chapters) descParts.push(`${item.chapters} chapters`);
                    else if (item.volumes) descParts.push(`${item.volumes} volumes`);
                    if (item.countryOfOrigin && item.countryOfOrigin !== 'JP') {
                        const originMap: Record<string, string> = {
                            'KR': 'Manhwa',
                            'CN': 'Manhua',
                            'TW': 'Taiwanese'
                        };
                        descParts.push(originMap[item.countryOfOrigin] || item.countryOfOrigin);
                    }
                }

                if (genres.length > 0) {
                    descParts.push(genres.slice(0, 2).join(', '));
                }
                if (item.averageScore) {
                    descParts.push(`${item.averageScore}%`);
                }

                // Build AI analysis payload for vector embeddings
                let analysisPayload = '';
                if (this.mediaType === 'ANIME') {
                    analysisPayload = `Type: Anime (${item.format || 'TV'}). Title: ${title}. Studio: ${studios.join(', ')}. Director: ${keyPerson || 'Unknown'}. Tags: ${tags.slice(0, 10).join(', ')}. Genres: ${genres.join(', ')}. Description: ${description}`;
                } else {
                    analysisPayload = `Type: Manga (${item.format || 'MANGA'}). Title: ${title}. Author: ${keyPerson || 'Unknown'}. Origin: ${item.countryOfOrigin || 'JP'}. Tags: ${tags.slice(0, 10).join(', ')}. Genres: ${genres.join(', ')}. Description: ${description}`;
                }

                // Build metadata object
                const metadata: any = {
                    anilistId: item.id,
                    type: this.mediaType.toLowerCase(),
                    format: item.format,
                    status: item.status,
                    siteUrl: item.siteUrl,
                    // Display
                    titleRomaji: item.title.romaji,
                    titleNative: item.title.native,
                    bannerImage: item.bannerImage,
                    coverColor: item.coverImage?.color,
                    // Scores
                    averageScore: item.averageScore,
                    popularity: item.popularity,
                    isAdult: item.isAdult,
                    // Dates
                    startYear: item.startDate?.year,
                    endYear: item.endDate?.year,
                    // Tags & Genres
                    genres: genres,
                    tags: tags.slice(0, 15),
                    allTags: item.tags?.map((t: any) => ({ name: t.name, rank: t.rank, category: t.category })) || [],
                    // Staff
                    staff: staff.slice(0, 5),
                    keyPerson: keyPerson,
                    // AI Payload
                    analysisPayload: analysisPayload
                };

                // Anime-specific fields
                if (this.mediaType === 'ANIME') {
                    metadata.episodes = item.episodes;
                    metadata.duration = item.duration;
                    metadata.season = item.season;
                    metadata.seasonYear = item.seasonYear;
                    metadata.studios = studios;
                    if (item.nextAiringEpisode) {
                        metadata.nextEpisode = item.nextAiringEpisode.episode;
                        metadata.nextAiringAt = item.nextAiringEpisode.airingAt;
                    }
                }

                // Manga-specific fields
                if (this.mediaType === 'MANGA') {
                    metadata.chapters = item.chapters;
                    metadata.volumes = item.volumes;
                    metadata.countryOfOrigin = item.countryOfOrigin;
                }

                return {
                    id: `anilist-${item.id}`,
                    type: this.mediaType === 'ANIME' ? 'anime' : 'manga',
                    title,
                    description: descParts.join(' • ') || description.substring(0, 150) || `${this.mediaType === 'ANIME' ? 'Anime' : 'Manga'}${year ? ` from ${year}` : ''}`,
                    imageUrl,
                    year,
                    tags: [...genres, ...tags.slice(0, 5)].slice(0, 8),
                    metadata: JSON.stringify(metadata)
                };
            });

            return { success: true, data: results };
        } catch (error) {
            console.error("AniList API error:", error);
            return { success: false, data: [], error: "AniList API Unreachable" };
        }
    }
}
