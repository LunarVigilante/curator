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
    { label: 'D', color: 'bg-blue-500 hover:bg-blue-600' },
    { label: 'F', color: 'bg-gray-500 hover:bg-gray-600' },
]

export default function TierSelector({ itemId }: { itemId: string }) {
    const [loading, setLoading] = useState(false)

    const handleRate = async (tier: string) => {
        setLoading(true)
        // Map tier to a rough numerical value for sorting if needed, or just store 0
        // For now we just store the tier string
        await rateItem(itemId, 0, 'TIER', tier)
        setLoading(false)
    }

    return (
        <div className="space-y-4">
            <label className="text-sm font-medium">Select Tier</label>
            <div className="flex gap-2 flex-wrap">
                {TIERS.map((tier) => (
                    <Button
                        key={tier.label}
                        onClick={() => handleRate(tier.label)}
                        disabled={loading}
                        className={cn("w-12 h-12 text-lg font-bold", tier.color)}
                    >
                        {tier.label}
                    </Button>
                ))}
            </div>
        </div>
    )
}
