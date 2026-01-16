import { ImportRouter } from '@/lib/services/import/ImportRouter';
import { ParsedImport } from '@/lib/types/import';

// Mock fetch
const originalFetch = global.fetch;
global.fetch = async (url: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const urlStr = url.toString();
    console.log(`Fetching: ${urlStr}`);

    if (urlStr.includes('spotify.com/api/token')) {
        return {
            ok: true,
            json: async () => ({ access_token: 'mock-token', expires_in: 3600 })
        } as Response;
    }

    if (urlStr.includes('api.spotify.com/v1/playlists/')) {
        if (urlStr.includes('/tracks')) {
            return {
                ok: true,
                json: async () => ({
                    items: [
                        { track: { name: 'Song 1', artists: [{ name: 'Artist 1' }], album: { name: 'Album 1', release_date: '2020-01-01' } } },
                        { track: { name: 'Song 2', artists: [{ name: 'Artist 2' }], album: { name: 'Album 2', release_date: '2021-01-01' } } }
                    ]
                })
            } as Response;
        }
        // Playlist info
        return {
            ok: true,
            json: async () => ({ name: 'Mock Playlist', description: 'Mock Description' })
        } as Response;
    }

    if (urlStr.includes('letterboxd.com')) {
        const html = `
            <html>
                <h1 class="title-1">Mock Letterboxd List</h1>
                <div class="list-description"><p>Mock Description</p></div>
                <ul class="poster-list">
                    <li class="posteritem">
                        <div class="film-poster" data-film-name="Movie 1" data-film-release-year="2020"></div>
                    </li>
                    <li class="posteritem">
                         <div class="react-component" data-component-class="LazyPoster" data-item-name="Movie 2 (2021)"></div>
                    </li>
                </ul>
            </html>
        `;
        return {
            ok: true,
            text: async () => html
        } as Response;
    }

    if (urlStr.includes('imdb.com')) {
        const json = {
            props: {
                pageProps: {
                    mainColumnData: {
                        list: {
                            name: { text: 'Mock IMDb List' },
                            description: { plotText: { plainText: 'Mock Description' } },
                            titleListItemSearch: {
                                edges: [
                                    { listItem: { titleText: { text: 'Movie 1' }, releaseYear: { year: 2020 }, titleType: { id: 'movie' } } },
                                    { listItem: { titleText: { text: 'TV Show 1' }, releaseYear: { year: 2021 }, titleType: { id: 'tvSeries' } } }
                                ]
                            }
                        }
                    }
                }
            }
        };
        const html = `
            <html>
                <script id="__NEXT_DATA__" type="application/json">${JSON.stringify(json)}</script>
            </html>
        `;
        return {
            ok: true,
            text: async () => html
        } as Response;
    }

    return originalFetch(url, init);
};

// Set Env
process.env.SPOTIFY_CLIENT_ID = 'mock';
process.env.SPOTIFY_CLIENT_SECRET = 'mock';

async function test() {
    const router = new ImportRouter();

    console.log('Testing Spotify...');
    const spotifyResult = await router.route('https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M');
    console.log('Spotify Items:', spotifyResult.items.length);
    console.log('Spotify First Item:', spotifyResult.items[0]);
    if (spotifyResult.items.length !== 2) throw new Error('Spotify failed');

    console.log('\nTesting Letterboxd...');
    const letterboxdResult = await router.route('https://letterboxd.com/user/list/mock-list/');
    console.log('Letterboxd Items:', letterboxdResult.items.length);
    console.log('Letterboxd First Item:', letterboxdResult.items[0]);
    if (letterboxdResult.items.length !== 2) throw new Error('Letterboxd failed');

    console.log('\nTesting IMDb...');
    const imdbResult = await router.route('https://www.imdb.com/list/ls12345/');
    console.log('IMDb Items:', imdbResult.items.length);
    console.log('IMDb First Item:', imdbResult.items[0]);
    if (imdbResult.items.length !== 2) throw new Error('IMDb failed');

    console.log('\nAll tests passed!');
}

test().catch(error => {
    console.error(error);
    process.exit(1);
});
