import { getItem } from '@/lib/actions/items'
import { notFound } from 'next/navigation'
import ItemDetailClient from './ItemDetailClient'

export default async function ItemDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    const item = await getItem(id)

    if (!item) {
        notFound()
    }

    // Ensure item structure matches client expectations
    const serializedItem = {
        ...item,
        ratings: item.ratings || [],
        updatedAt: item.updatedAt || new Date()
    }

    return <ItemDetailClient item={serializedItem as any} />
}
