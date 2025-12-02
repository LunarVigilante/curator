import { getItems } from '@/lib/actions/items'
import ItemsPageClient from '@/components/items/ItemsPageClient'

export default async function ItemsPage({
    searchParams,
}: {
    searchParams: Promise<{ q?: string }>
}) {
    const { q: query } = await searchParams
    const items = await getItems(query)

    return <ItemsPageClient items={items} initialQuery={query} />
}
