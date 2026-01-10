
import { sleep } from '@/lib/harvesters/shared';

// Hardcoded Free Tier Key as requested
const TADB_API_KEY = '123';
const TADB_BASE_URL = `https://www.theaudiodb.com/api/v1/json/${TADB_API_KEY}`;

export class TheAudioDBService {

    /**
     * Search for an album and return the best available cover art.
     * Priority: strAlbumThumbHQ (High Quality) > strAlbumThumb (Standard)
     */
    static async getBestAlbumCover(artist: string, album: string): Promise<string | null> {
        if (!artist || !album) return null;

        const encodedArtist = encodeURIComponent(artist);
        const encodedAlbum = encodeURIComponent(album);
        const url = `${TADB_BASE_URL}/searchalbum.php?s=${encodedArtist}&a=${encodedAlbum}`;

        try {
            const res = await fetch(url);

            if (!res.ok) {
                console.warn(`   ⚠️ AudioDB Error ${res.status}: ${res.statusText}`);
                return null;
            }

            const data = await res.json();

            if (!data || !data.album || !Array.isArray(data.album) || data.album.length === 0) {
                return null;
            }

            // AudioDB can return multiple matches, but usually the first is best for exact text search.
            const match = data.album[0];

            // Priority Logic
            if (match.strAlbumThumbHQ) return match.strAlbumThumbHQ;
            if (match.strAlbumThumb) return match.strAlbumThumb;

            return null;

        } catch (error) {
            console.error('   ❌ AudioDB Fetch Error:', error);
            return null;
        }
    }
}
