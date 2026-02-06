'use client'

import React, { useMemo } from 'react'
import ReactMarkdown from 'react-markdown'
import type { GlobalItem } from '../types'

interface StructuredDescriptionProps {
    item: GlobalItem
}

/**
 * Strips "Keywords: [tag1], [tag2]..." line from text for display
 * Also handles markdown bold: **Keywords:** 
 * Removes everything from "Keywords:" to the end of the string
 */
function stripKeywordsLine(text: string): string {
    if (!text) return ''
    // Match optional ** + Keywords: + everything after to end of string
    return text.replace(/\n*\*{0,2}Keywords:?\*{0,2}[\s\S]*$/i, '').trim()
}

/**
 * Strips "Production Tags: [tag1], [tag2]..." line from text for display
 * Also handles markdown bold: **Production Tags:**
 * Removes everything from "Production Tags:" to the end of the string
 */
function stripProductionTagsLine(text: string): string {
    if (!text) return ''
    // Match optional ** + Production Tags: + everything after to end of string
    return text.replace(/\n*\*{0,2}Production Tags:?\*{0,2}[\s\S]*$/i, '').trim()
}

/**
 * Structured description component with section headers.
 * Renders description_parts if available, falls back to full description.
 * 
 * NOTE: This component strips semantic metadata (Keywords and Production Tags)
 * from the display. These are preserved in the database for vector search.
 * 
 * Sections:
 * - PREMISE: Core concept/setup
 * - THEMATIC DEPTH: Themes and deeper meanings (Keywords stripped)
 * - TONE & ATMOSPHERE: Mood and feel
 * - SIGNATURE STYLE: Visual/technical signature (Production Tags stripped)
 */
export function StructuredDescription({ item }: StructuredDescriptionProps) {
    const parts = item.description_parts

    // Strip semantic metadata for display (Keywords from themes, Production Tags from style)
    const displayParts = useMemo(() => {
        if (!parts) return null
        return {
            premise: parts.premise,
            themes: stripKeywordsLine(parts.themes || ''),
            tone: parts.tone,
            style: stripProductionTagsLine(parts.style || '')
        }
    }, [parts])

    // Fallback to single description if no parts
    if (!displayParts || (!displayParts.premise && !displayParts.themes && !displayParts.tone && !displayParts.style)) {
        if (!item.description) return null

        return (
            <div className="prose prose-invert max-w-none text-white/90 text-sm leading-relaxed font-light">
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
            {displayParts.premise && (
                <DescriptionSection title="PREMISE" content={displayParts.premise} />
            )}

            {/* THEMATIC DEPTH Section - Keywords stripped for display */}
            {displayParts.themes && (
                <DescriptionSection title="THEMATIC DEPTH" content={displayParts.themes} />
            )}

            {/* TONE & ATMOSPHERE Section */}
            {displayParts.tone && (
                <DescriptionSection title="TONE & ATMOSPHERE" content={displayParts.tone} />
            )}

            {/* SIGNATURE STYLE Section - Production Tags stripped for display */}
            {displayParts.style && (
                <DescriptionSection title="SIGNATURE STYLE" content={displayParts.style} />
            )}
        </div>
    )
}

function DescriptionSection({ title, content }: { title: string; content: string }) {
    return (
        <div className="space-y-2">
            <h4 className="text-[10px] font-bold text-zinc-300 uppercase tracking-[0.2em]">
                {title}
            </h4>
            <div className="prose prose-invert max-w-none text-white/90 text-sm leading-relaxed font-light">
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
