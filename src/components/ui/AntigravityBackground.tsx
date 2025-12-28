'use client'

import { cn } from "@/lib/utils";

export function AntigravityBackground({ className }: { className?: string }) {
    return (
        <div className={cn("fixed inset-0 z-[-1] overflow-hidden bg-zinc-950 pointer-events-none select-none", className)}>

            {/* Ambient Blobs (Glacial Drift) */}
            <div className="absolute inset-0 z-0 overflow-hidden opacity-30">
                {/* Blob 1: Blue - Top Leftish */}
                <div
                    className="absolute top-[-10%] left-[-10%] w-[60vw] h-[60vw] bg-blue-600/30 rounded-full blur-[120px] animate-blob [animation-duration:25s]"
                />

                {/* Blob 2: Purple - Bottom Rightish */}
                <div
                    className="absolute bottom-[-10%] right-[-10%] w-[60vw] h-[60vw] bg-purple-600/30 rounded-full blur-[120px] animate-blob [animation-duration:30s] animate-delay-1000"
                />

                {/* Blob 3: Indigo - Centerish */}
                <div
                    className="absolute top-[20%] left-[20%] w-[50vw] h-[50vw] bg-indigo-500/20 rounded-full blur-[100px] animate-blob [animation-duration:35s] animate-delay-2000"
                />
            </div>

            {/* Technical Grid Overlay */}
            <div
                className="absolute inset-0 z-10 opacity-10"
                style={{
                    backgroundImage: `
                        linear-gradient(to right, #ffffff0a 1px, transparent 1px),
                        linear-gradient(to bottom, #ffffff0a 1px, transparent 1px)
                    `,
                    backgroundSize: '40px 40px',
                    maskImage: 'radial-gradient(ellipse at center, black 40%, transparent 100%)',
                    WebkitMaskImage: 'radial-gradient(ellipse at center, black 40%, transparent 100%)'
                }}
            />
        </div>
    );
}
