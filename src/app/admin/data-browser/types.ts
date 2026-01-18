// Types for Data Browser
// Re-using GlobalItem from ItemDetailView to ensure compatibility
export type { GlobalItem } from '@/components/item-details/types'

export interface Stats {
    total: number
    byCategory: Record<string, number>
}
