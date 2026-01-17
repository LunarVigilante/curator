import * as cheerio from 'cheerio'
import {
    type ImportStrategy,
    type ParsedImport,
    type ParsedImportItem,
    URL_PATTERNS
} from '@/lib/types/import'

export class LetterboxdAdapter implements ImportStrategy {
    name = 'LetterboxdAdapter'

    canHandle(input: string): boolean {
        return URL_PATTERNS.LETTERBOXD_LIST.test(input) ||
               URL_PATTERNS.LETTERBOXD_WATCHLIST.test(input)
    }

    async parse(input: string): Promise<ParsedImport> {
        const items: ParsedImportItem[] = []
        let currentUrl = input
        let pageCount = 0
        const MAX_PAGES = 10

        let collectionTitle = ''
        let collectionDescription = ''

        while (currentUrl && pageCount < MAX_PAGES) {
            const html = await this.fetchPage(currentUrl)
            const $ = cheerio.load(html)

            if (pageCount === 0) {
                collectionTitle = $('h1.title-1').text().trim() ||
                                  $('meta[property="og:title"]').attr('content')?.replace(' • Letterboxd', '') ||
                                  'Letterboxd List'

                collectionDescription = $('.list-description p').text().trim() ||
                                        $('meta[property="og:description"]').attr('content') ||
                                        ''
            }

            const pageItems = this.parsePage($)
            items.push(...pageItems)

            // Check for next page
            const nextLink = $('.pagination .next').attr('href')
            if (nextLink) {
                // Handle relative URL
                const baseUrl = 'https://letterboxd.com'
                currentUrl = nextLink.startsWith('http') ? nextLink : `${baseUrl}${nextLink}`
                pageCount++
            } else {
                currentUrl = ''
            }
        }

        if (items.length === 0) {
            throw new Error('No items found in Letterboxd list')
        }

        return {
            source: 'letterboxd_list',
            collectionTitle,
            collectionDescription,
            mediaType: 'movie',
            items: items.map((item, index) => ({
                ...item,
                rank: index + 1 // Re-rank based on full list
            })),
            parseConfidence: 1
        }
    }

    private async fetchPage(url: string): Promise<string> {
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        })
        if (!response.ok) {
             throw new Error(`Failed to fetch Letterboxd list: ${response.status}`)
        }
        return await response.text()
    }

    private parsePage($: cheerio.CheerioAPI): ParsedImportItem[] {
        const items: ParsedImportItem[] = []

        $('.poster-list .posteritem').each((_, el) => {
            const $el = $(el)

            let title: string | undefined
            let releaseYear: number | undefined
            let rawInput: string | undefined

            // Strategy 1: data attributes on .film-poster
            const $poster = $el.find('.film-poster')
            const dataName = $poster.attr('data-film-name')
            const dataYear = $poster.attr('data-film-release-year')

            if (dataName) {
                title = dataName
                if (dataYear) releaseYear = parseInt(dataYear)
                rawInput = `${title} (${dataYear || '?'})`
            } else {
                // Strategy 2: LazyPoster data-item-name
                const $lazyPoster = $el.find('[data-component-class="LazyPoster"]')
                const nameWithYear = $lazyPoster.attr('data-item-name') || $el.find('img').attr('alt')

                if (nameWithYear) {
                    rawInput = nameWithYear
                    const yearMatch = nameWithYear.match(/(.*)\s+\((\d{4})\)$/)
                    if (yearMatch) {
                        title = yearMatch[1]
                        releaseYear = parseInt(yearMatch[2])
                    } else {
                        title = nameWithYear
                    }
                }
            }

            if (title) {
                items.push({
                    title: title,
                    releaseYear: releaseYear,
                    mediaType: 'movie',
                    confidence: 1,
                    rawInput: rawInput
                })
            }
        })

        return items
    }
}
