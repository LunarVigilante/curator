import { getItems } from '@/lib/actions/items'
import ItemsPageClient from '@/components/items/ItemsPageClient'

export default async function ItemsPage({
    searchParams,
}: {
    searchParams: Promise<{ q?: string; page?: string }>
}) {
    const { q: query, page } = await searchParams
    const currentPage = Number(page) || 1
    const { items, totalPages } = await getItems(query, currentPage)

    return (
        <ItemsPageClient
            items={items}
            initialQuery={query}
            totalPages={totalPages}
            currentPage={currentPage}
        />
    )
}
