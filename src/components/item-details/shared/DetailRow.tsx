'use client'

import { cn } from '@/lib/utils'

interface DetailRowProps {
    label: string
    children: React.ReactNode
    className?: string
}

/**
 * A reusable detail row component for displaying labeled metadata
 */
export function DetailRow({ label, children, className }: DetailRowProps) {
    if (!children) return null
    return (
        <div className={cn("space-y-0.5", className)}>
            <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold">{label}</span>
            <div className="text-zinc-200 text-sm font-medium leading-tight flex items-center gap-2">
                {children}
            </div>
        </div>
    )
}

/**
 * Visually hidden content for accessibility
 */
export function VisuallyHidden({ children }: { children: React.ReactNode }) {
    return <span className="sr-only">{children}</span>
}
