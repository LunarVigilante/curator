import { getItems } from '@/lib/actions/items'
import ItemsPageClient from '@/components/items/ItemsPageClient'

export default async function ItemsPage({
    searchParams,
}: {
    searchParams: Promise<{ q?: string; page?: string; limit?: string }>
}) {
    const { q: query, page, limit } = await searchParams
    const currentPage = Number(page) || 1
    const currentLimit = Number(limit) || 24 // Default to reasonable value
    const { items, totalPages } = await getItems(query, currentPage, currentLimit)

    return (
        <ItemsPageClient
            items={items}
            initialQuery={query}
            totalPages={totalPages}
            currentPage={currentPage}
        />
    )
}
