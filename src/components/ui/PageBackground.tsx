'use client'

import { AmbientBackground } from './AmbientBackground'
import { cn } from '@/lib/utils'

interface PageBackgroundProps {
    imageUrl?: string | null
    children?: React.ReactNode
    className?: string
}

export function PageBackground({ imageUrl, children, className }: PageBackgroundProps) {
    const hasImage = !!imageUrl

    return (
        <div className={cn("relative min-h-screen w-full overflow-hidden bg-zinc-950", className)}>
            {/* LAYER A: Optional Image */}
            {hasImage && (
                <div className="absolute inset-0 z-0 scale-105">
                    <img
                        src={imageUrl}
                        alt=""
                        className="h-full w-full object-cover blur-3xl opacity-60 transition-opacity duration-1000"
                    />
                    <div className="absolute inset-0 bg-black/50" />
                </div>
            )}

            {/* LAYER B: The Mesh (Dynamic Mode) */}
            <AmbientBackground
                className={cn(
                    "absolute inset-0 transition-all duration-1000",
                    hasImage
                        ? "z-[1] mix-blend-overlay opacity-80"
                        : "z-0 mix-blend-normal opacity-100"
                )}
            />

            {/* LAYER C: Content */}
            <div className="relative z-10 w-full">
                {children}
            </div>
        </div>
    )
}
