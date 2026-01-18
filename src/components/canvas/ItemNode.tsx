'use client'

import React, { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

export interface ItemNodeData extends Record<string, unknown> {
    title: string
    image: string | null
    tier?: string | null
    category?: string
    similarity?: number
}

const TIER_COLORS: Record<string, string> = {
    'S': 'bg-red-500 border-red-400',
    'A': 'bg-orange-500 border-orange-400',
    'B': 'bg-yellow-500 border-yellow-400',
    'C': 'bg-green-500 border-green-400',
    'D': 'bg-blue-500 border-blue-400',
    'E': 'bg-indigo-500 border-indigo-400',
    'F': 'bg-purple-500 border-purple-400',
}

function ItemNodeComponent({ data, selected }: NodeProps) {
    const nodeData = data as ItemNodeData
    const { title, image, tier, similarity } = nodeData

    return (
        <div
            className={cn(
                "relative rounded-lg overflow-hidden transition-all duration-200",
                "bg-black/80 backdrop-blur-sm border-2",
                selected
                    ? "border-white shadow-lg shadow-white/20 scale-105"
                    : "border-white/20 hover:border-white/40",
                "w-[140px]"
            )}
        >
            {/* Connection handles */}
            <Handle
                type="target"
                position={Position.Left}
                className="!bg-purple-500 !border-purple-300 !w-3 !h-3"
            />
            <Handle
                type="source"
                position={Position.Right}
                className="!bg-purple-500 !border-purple-300 !w-3 !h-3"
            />

            {/* Image */}
            <div className="relative w-full aspect-[3/4] bg-gray-900">
                {image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                        src={image}
                        alt={title}
                        className="w-full h-full object-cover"
                        draggable={false}
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-white/30">
                        No Image
                    </div>
                )}

                {/* Tier badge */}
                {tier && (
                    <div className="absolute top-2 left-2">
                        <Badge
                            className={cn(
                                "text-white font-bold text-xs px-1.5 py-0.5",
                                TIER_COLORS[tier] || "bg-gray-500"
                            )}
                        >
                            {tier}
                        </Badge>
                    </div>
                )}

                {/* Similarity indicator */}
                {similarity !== undefined && similarity > 0 && (
                    <div className="absolute bottom-2 right-2">
                        <Badge
                            variant="secondary"
                            className="bg-black/60 text-white text-xs"
                        >
                            {Math.round(similarity * 100)}%
                        </Badge>
                    </div>
                )}
            </div>

            {/* Title */}
            <div className="p-2">
                <p className="text-xs text-white/90 font-medium line-clamp-2 text-center">
                    {title}
                </p>
            </div>
        </div>
    )
}

export const ItemNode = memo(ItemNodeComponent)
