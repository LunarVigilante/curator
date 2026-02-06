/**
 * Franchise Discovery Service
 * 
 * Exports utilities for discovering and managing TV franchise relationships:
 * - MediaGraph: Graph-based cluster detection via shared creators
 * - Constants: TMDB keyword mappings and known spinoffs
 */

export {
    MediaGraph,
    ROLE_WEIGHTS,
    buildGraphFromCredits,
} from './media-graph';

export {
    UNIVERSE_KEYWORD_MAP,
    PROLIFIC_SHOWRUNNERS,
    KNOWN_SPINOFFS,
    getUniverseSlugFromKeyword,
    detectUniverseFromKeywords,
} from '@/lib/constants/franchise-keywords';
