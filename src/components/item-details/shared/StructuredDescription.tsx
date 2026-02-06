'use client'

import React from 'react'
import ReactMarkdown from 'react-markdown'
import type { GlobalItem } from '../types'

interface StructuredDescriptionProps {
    item: GlobalItem
}

/**
 * Structured description component with section headers.
 * Renders description_parts if available, falls back to full description.
 * 
 * Sections:
 * - PREMISE: Core concept/setup
 * - THEMATIC DEPTH: Themes and deeper meanings
 * - TONE & ATMOSPHERE: Mood and feel
 * - SIGNATURE STYLE: Visual/technical signature
 */
export function StructuredDescription({ item }: StructuredDescriptionProps) {
    const parts = item.description_parts

    // Fallback to single description if no parts
    if (!parts || (!parts.premise && !parts.themes && !parts.tone && !parts.style)) {
        if (!item.description) return null

        return (
            <div className="prose prose-invert max-w-none text-zinc-300 text-sm leading-relaxed font-light">
                <ReactMarkdown
                    components={{
                        p: ({ children }) => <p className="mb-3 last:mb-0">{children}</p>,
                        strong: ({ children }) => <strong className="font-bold text-white">{children}</strong>
                    }}
                >
                    {item.description}
                </ReactMarkdown>
            </div>
        )
    }

    return (
        <div className="space-y-5">
            {/* PREMISE Section */}
            {parts.premise && (
                <DescriptionSection title="PREMISE" content={parts.premise} />
            )}

            {/* THEMATIC DEPTH Section */}
            {parts.themes && (
                <DescriptionSection title="THEMATIC DEPTH" content={parts.themes} />
            )}

            {/* TONE & ATMOSPHERE Section */}
            {parts.tone && (
                <DescriptionSection title="TONE & ATMOSPHERE" content={parts.tone} />
            )}

            {/* SIGNATURE STYLE Section */}
            {parts.style && (
                <DescriptionSection title="SIGNATURE STYLE" content={parts.style} />
            )}
        </div>
    )
}

function DescriptionSection({ title, content }: { title: string; content: string }) {
    return (
        <div className="space-y-2">
            <h4 className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em]">
                {title}
            </h4>
            <div className="prose prose-invert max-w-none text-zinc-300 text-sm leading-relaxed font-light">
                <ReactMarkdown
                    components={{
                        p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                        strong: ({ children }) => (
                            <strong className="font-bold text-white">{children}</strong>
                        )
                    }}
                >
                    {content}
                </ReactMarkdown>
            </div>
        </div>
    )
}
