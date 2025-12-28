'use client'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Trophy } from 'lucide-react'
import Image from 'next/image'
import type { ShareCardData, ShareTemplate } from '@/lib/actions/sharing'

interface ShareCardProps {
    data: ShareCardData
    template: ShareTemplate
}

export function ShareCard({ data, template }: ShareCardProps) {
    const curatorName = data.curator.displayName || data.curator.name
    const initials = curatorName.slice(0, 2).toUpperCase()

    // Template-specific styles
    const containerStyles = {
        default: 'w-full h-full p-6',
        instagram: 'w-full h-full p-8 flex flex-col',
        twitter: 'w-full h-full p-4 flex flex-row gap-4',
    }

    return (
        <div
            className={`
                bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900 
                rounded-xl border border-white/10 overflow-hidden
                ${containerStyles[template]}
            `}
        >
            {template === 'twitter' ? (
                // Twitter Layout (horizontal)
                <>
                    {/* Left side - Top 3 thumbnails */}
                    <div className="flex-shrink-0 flex flex-col gap-2">
                        {data.topItems.map((item, index) => (
                            <div key={item.id} className="relative">
                                {item.image ? (
                                    <Image
                                        src={item.image}
                                        alt={item.name}
                                        width={60}
                                        height={60}
                                        className="rounded object-cover w-15 h-15"
                                    />
                                ) : (
                                    <div className="w-15 h-15 rounded bg-zinc-700 flex items-center justify-center">
                                        <Trophy className="w-6 h-6 text-zinc-500" />
                                    </div>
                                )}
                                <div className="absolute -top-1 -left-1 w-5 h-5 rounded-full bg-gradient-to-br from-yellow-500 to-orange-500 flex items-center justify-center text-xs font-bold text-black">
                                    {index + 1}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Right side - Info */}
                    <div className="flex-1 flex flex-col justify-between">
                        <div>
                            <div className="text-sm text-zinc-500 mb-1">Top 3</div>
                            <h2 className="text-xl font-bold text-white mb-2">
                                {data.category.emoji} {data.category.name}
                            </h2>
                            <div className="space-y-1">
                                {data.topItems.map((item, index) => (
                                    <div key={item.id} className="text-sm text-zinc-300 truncate">
                                        <span className="text-yellow-500 font-bold mr-2">{index + 1}.</span>
                                        {item.name}
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                            <Avatar className="w-6 h-6">
                                <AvatarImage src={data.curator.image || undefined} />
                                <AvatarFallback className="text-xs bg-zinc-700">{initials}</AvatarFallback>
                            </Avatar>
                            <span className="text-sm text-zinc-400">@{curatorName}</span>
                        </div>
                    </div>
                </>
            ) : template === 'instagram' ? (
                // Instagram Story Layout (vertical)
                <>
                    {/* Header */}
                    <div className="text-center mb-6">
                        <div className="text-lg text-zinc-400 mb-2">My Top 3</div>
                        <h1 className="text-2xl font-black text-white">
                            {data.category.emoji} {data.category.name}
                        </h1>
                    </div>

                    {/* Items */}
                    <div className="flex-1 space-y-4">
                        {data.topItems.map((item, index) => (
                            <div
                                key={item.id}
                                className="flex items-center gap-4 p-3 rounded-lg bg-white/5 border border-white/10"
                            >
                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-yellow-500 to-orange-500 flex items-center justify-center text-lg font-black text-black">
                                    {index + 1}
                                </div>
                                {item.image ? (
                                    <Image
                                        src={item.image}
                                        alt={item.name}
                                        width={56}
                                        height={56}
                                        className="rounded object-cover w-14 h-14"
                                    />
                                ) : (
                                    <div className="w-14 h-14 rounded bg-zinc-700" />
                                )}
                                <div className="flex-1 min-w-0">
                                    <div className="font-bold text-white truncate">{item.name}</div>
                                    {item.tier && (
                                        <div className="text-yellow-500 font-bold text-sm">{item.tier} Tier</div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Footer */}
                    <div className="mt-6 flex items-center justify-center gap-3">
                        <Avatar className="w-8 h-8">
                            <AvatarImage src={data.curator.image || undefined} />
                            <AvatarFallback className="bg-zinc-700">{initials}</AvatarFallback>
                        </Avatar>
                        <span className="text-zinc-300 font-medium">{curatorName}</span>
                    </div>
                    <div className="text-center mt-3 text-xs text-zinc-500">
                        curator.app
                    </div>
                </>
            ) : (
                // Default Square Layout
                <>
                    {/* Header */}
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <div className="text-xs text-zinc-500 uppercase tracking-wider">Top 3</div>
                            <h2 className="text-lg font-bold text-white">
                                {data.category.emoji} {data.category.name}
                            </h2>
                        </div>
                        <Avatar className="w-8 h-8">
                            <AvatarImage src={data.curator.image || undefined} />
                            <AvatarFallback className="bg-zinc-700 text-xs">{initials}</AvatarFallback>
                        </Avatar>
                    </div>

                    {/* Items Grid */}
                    <div className="flex-1 space-y-3">
                        {data.topItems.map((item, index) => (
                            <div
                                key={item.id}
                                className="flex items-center gap-3 p-2 rounded-lg bg-white/5"
                            >
                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-yellow-500 to-orange-500 flex items-center justify-center font-black text-black">
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
                                <div className="flex-1 min-w-0">
                                    <div className="font-medium text-white text-sm truncate">{item.name}</div>
                                    {item.tier && (
                                        <div className="text-yellow-500 text-xs font-bold">{item.tier}</div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Footer */}
                    <div className="mt-4 text-center text-xs text-zinc-500">
                        curated by {curatorName} • curator.app
                    </div>
                </>
            )}
        </div>
    )
}
