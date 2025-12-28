'use client'

import { forwardRef } from 'react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import Image from 'next/image'

/**
 * Legacy ShareCard for TierListBoard image export.
 * This is separate from the new social sharing ShareCard.
 */

interface LegacyShareCardProps {
    userName: string
    userImage: string | null | undefined
    listTitle: string
    items: {
        id: string
        name: string
        image: string | null
        tier?: string | null
    }[]
}

export const LegacyShareCard = forwardRef<HTMLDivElement, LegacyShareCardProps>(
    ({ userName, userImage, listTitle, items }, ref) => {
        const initials = userName.slice(0, 2).toUpperCase()
        const topItems = items.filter(i => i.tier === 'S').slice(0, 5)

        return (
            <div
                ref={ref}
                className="w-[600px] p-8 bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900 rounded-2xl border border-white/10"
            >
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <div className="text-sm text-zinc-500 uppercase tracking-wider">My Rankings</div>
                        <h2 className="text-2xl font-bold text-white">{listTitle}</h2>
                    </div>
                    <div className="flex items-center gap-3">
                        <Avatar className="w-10 h-10">
                            <AvatarImage src={userImage || undefined} />
                            <AvatarFallback className="bg-zinc-700">{initials}</AvatarFallback>
                        </Avatar>
                        <span className="text-zinc-300 font-medium">{userName}</span>
                    </div>
                </div>

                {/* S-Tier Items */}
                {topItems.length > 0 && (
                    <div className="space-y-3">
                        <div className="text-sm text-yellow-500 font-bold">S-TIER</div>
                        <div className="flex gap-3 flex-wrap">
                            {topItems.map((item, index) => (
                                <div
                                    key={item.id}
                                    className="flex items-center gap-3 p-3 rounded-lg bg-white/5 border border-white/10"
                                >
                                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-yellow-500 to-orange-500 flex items-center justify-center font-bold text-black text-sm">
                                        {index + 1}
                                    </div>
                                    {item.image ? (
                                        <Image
                                            src={item.image}
                                            alt={item.name}
                                            width={48}
                                            height={48}
                                            className="rounded object-cover w-12 h-12"
                                        />
                                    ) : (
                                        <div className="w-12 h-12 rounded bg-zinc-700" />
                                    )}
                                    <span className="font-medium text-white text-sm">{item.name}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Footer */}
                <div className="mt-6 text-center text-xs text-zinc-500">
                    curator.app
                </div>
            </div>
        )
    }
)

LegacyShareCard.displayName = 'LegacyShareCard'
