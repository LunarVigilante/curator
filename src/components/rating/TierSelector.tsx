'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { rateItem } from '@/lib/actions/ratings'
import { cn } from '@/lib/utils'

const TIERS = [
    { label: 'S', color: 'bg-red-500 hover:bg-red-600' },
    { label: 'A', color: 'bg-orange-500 hover:bg-orange-600' },
    { label: 'B', color: 'bg-yellow-500 hover:bg-yellow-600' },
    { label: 'C', color: 'bg-green-500 hover:bg-green-600' },
    { label: 'D', color: 'bg-blue-600 hover:bg-blue-700' },
    { label: 'F', color: 'bg-blue-600 hover:bg-blue-700' },
]

export default function TierSelector({
    itemId,
    activeTier,
    onTierChange,
    customRanks
}: {
    itemId?: string
    activeTier?: string
    onTierChange?: (tier: string) => void
    customRanks?: { name: string; color?: string | null }[]
}) {
    const [loading, setLoading] = useState(false)

    const tiersToUse = customRanks && customRanks.length > 0
        ? customRanks.map(r => ({ label: r.name, color: r.color || 'bg-gray-500 hover:bg-gray-600' }))
        : TIERS

    const handleRate = async (tier: string) => {
        if (onTierChange) {
            onTierChange(tier)
            return
        }

        if (!itemId) return

        setLoading(true)
        await rateItem(itemId, 0, 'TIER', tier)
        setLoading(false)
    }

    return (
        <div className="space-y-5">
            <label className="text-sm font-medium text-muted-foreground">Select Tier</label>
            <div className="flex gap-2 flex-wrap pt-2">
                {tiersToUse.map((tier) => {
                    const isActive = activeTier === tier.label
                    const isHex = tier.color.startsWith('#')

                    return (
                        <Button
                            key={tier.label}
                            type="button"
                            onClick={() => handleRate(tier.label)}
                            disabled={loading}
                            style={isHex ? { backgroundColor: tier.color, borderColor: tier.color } : undefined}
                            className={cn(
                                "w-auto px-4 py-2 min-w-[3rem] text-lg font-bold transition-all duration-200 whitespace-nowrap",
                                isHex ? "hover:brightness-110 text-black border" : tier.color,
                                isActive && "ring-4 ring-white shadow-[0_0_20px_rgba(255,255,255,0.4)] scale-110 z-10"
                            )}
                        >
                            {tier.label}
                        </Button>
                    )
                })}
            </div>
        </div>
    )
}
