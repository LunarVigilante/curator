import * as cheerio from 'cheerio'
import { safeFetch } from '@/lib/security'
import {
    type ImportStrategy,
    type ParsedImport,
    type ParsedImportItem,
    URL_PATTERNS
} from '@/lib/types/import'

export class ImdbAdapter implements ImportStrategy {
    name = 'ImdbAdapter'

    canHandle(input: string): boolean {
        return URL_PATTERNS.IMDB_LIST.test(input)
    }

    async parse(input: string): Promise<ParsedImport> {
        const items: ParsedImportItem[] = []
        let collectionTitle = 'IMDb List'
        let collectionDescription = ''

        const html = await this.fetchPage(input)
        const $ = cheerio.load(html)

        const nextData = $('#__NEXT_DATA__').html()
        if (!nextData) {
            // Fallback for older pages? Or just fail.
            // Most IMDb lists use Next.js now.
            throw new Error('Could not find IMDb data (NEXT_DATA)')
        }

        try {
            const json = JSON.parse(nextData)
            const listData = json.props?.pageProps?.mainColumnData?.list

            if (!listData) {
                // Try alternate path for other page types if needed, but for now strict.
                throw new Error('Invalid IMDb data structure: mainColumnData.list not found')
            }

            // Collection Info
            collectionTitle = listData.name?.originalText || listData.name?.text || 'IMDb List'
            collectionDescription = listData.description?.plotText?.plainText || ''

            // Items
            const edges = listData.titleListItemSearch?.edges || []

            edges.forEach((edge: any, index: number) => {
                const item = edge.listItem
                if (!item) return

                const title = item.titleText?.text
                const year = item.releaseYear?.year
                const type = item.titleType?.id // 'movie', 'tvSeries'
                const director = item.principalCreditsV2?.[0]?.credits?.[0]?.name?.nameText?.text

                if (title) {
                     items.push({
                        title: title,
                        releaseYear: year,
                        mediaType: this.mapImdbType(type),
                        director: director, // Optional, might be useful
                        rank: index + 1,
                        confidence: 1,
                        rawInput: `${title} (${year || '?'})`
                     })
                }
            })

        } catch (error) {
             console.error('IMDb parsing error:', error)
             if (error instanceof Error) {
                 throw new Error(`Failed to parse IMDb list data: ${error.message}`)
             }
             throw new Error('Failed to parse IMDb list data')
        }

        return {
            source: 'imdb_list',
            collectionTitle,
            collectionDescription,
            mediaType: 'mixed', // IMDb lists can be mixed
            items,
            parseConfidence: 1
        }
    }

    private async fetchPage(url: string): Promise<string> {
        // safeFetch handles isSafeUrl check and redirect validation
        const response = await safeFetch(url, {
             headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5'
            }
        })
        if (!response.ok) {
             throw new Error(`Failed to fetch IMDb list: ${response.status}`)
        }
        return await response.text()
    }

    private mapImdbType(type: string): 'movie' | 'tv' | 'mixed' | undefined {
        if (!type) return undefined
        if (type === 'movie' || type === 'tvMovie' || type === 'shortFilm') return 'movie'
        if (type === 'tvSeries' || type === 'tvMiniSeries' || type === 'tvSpecial') return 'tv'
        return undefined
    }
}
