'use client'

import { Badge } from '@/components/ui/badge'
import { MessageSquareQuote } from 'lucide-react'
import type { CuratorNote as CuratorNoteType } from '@/lib/actions/notes'

interface CuratorNoteProps {
    note: CuratorNoteType
    curatorName?: string
}

export function CuratorNote({ note, curatorName }: CuratorNoteProps) {
    return (
        <div className="relative p-4 rounded-lg bg-gradient-to-r from-purple-500/10 via-blue-500/10 to-purple-500/10 border border-purple-500/20">
            {/* Header Badge */}
            <div className="flex items-center gap-2 mb-2">
                <Badge
                    variant="secondary"
                    className="bg-purple-500/20 text-purple-300 border-purple-500/30 text-xs"
                >
                    <MessageSquareQuote className="w-3 h-3 mr-1" />
                    Curator's Note
                </Badge>
                {curatorName && (
                    <span className="text-xs text-zinc-500">by {curatorName}</span>
                )}
            </div>

            {/* Note Content */}
            <p className="text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap">
                {note.content}
            </p>
        </div>
    )
}
