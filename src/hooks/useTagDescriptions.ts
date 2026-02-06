'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

interface TagWithDescription {
    id: string
    name: string
    slug: string
    description: string | null
}

/**
 * Hook to fetch tag descriptions from the tags table
 * Maps cached_tags (id, name) to full tag records with descriptions
 */
export function useTagDescriptions(cachedTags: { id: string; name: string }[] | null) {
    const [tags, setTags] = useState<TagWithDescription[]>([])
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        if (!cachedTags?.length) {
            setTags([])
            return
        }

        const fetchDescriptions = async () => {
            setLoading(true)
            const supabase = createClient()

            // Convert names to slugs for lookup
            const slugs = cachedTags.map(t =>
                t.name.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
            )

            const { data } = await supabase
                .from('tags')
                .select('id, name, slug, description')
                .in('slug', slugs)

            if (data) {
                // Map to preserve order and include all tags
                const descriptionMap = new Map(data.map(t => [t.slug, t]))
                const enrichedTags = cachedTags.map(t => {
                    const slug = t.name.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
                    const fullTag = descriptionMap.get(slug)
                    return {
                        id: t.id,
                        name: t.name,
                        slug,
                        description: fullTag?.description || null
                    }
                })
                setTags(enrichedTags)
            } else {
                // Fallback to cached tags without descriptions
                setTags(cachedTags.map(t => ({
                    ...t,
                    slug: t.name.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
                    description: null
                })))
            }
            setLoading(false)
        }

        fetchDescriptions()
    }, [cachedTags])

    return { tags, loading }
}
