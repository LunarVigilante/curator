import { cn } from "@/lib/utils";

export function AmbientBackground({ className }: { className?: string }) {
    return (
        <div className={cn("fixed inset-0 z-[-1] overflow-hidden bg-zinc-950 pointer-events-none select-none", className)}>

            {/* 1. Ambient Blobs (Deep Space) */}
            <div className="absolute inset-0 z-0 overflow-hidden">
                {/* Blue Blob - Top Left */}
                <div className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] bg-blue-600/20 rounded-full blur-[120px] animate-pulse" />

                {/* Purple Blob - Bottom Right */}
                <div className="absolute bottom-[-10%] right-[-10%] w-[50vw] h-[50vw] bg-purple-600/20 rounded-full blur-[120px] animate-pulse delay-1000" />

                {/* Cyan/Indigo Accent - Center/Top */}
                <div className="absolute top-[20%] left-[40%] w-[30vw] h-[30vw] bg-indigo-500/10 rounded-full blur-[100px] animate-pulse delay-700" />
            </div>

            {/* 2. Technical Grid Overlay */}
            <div
                className="absolute inset-0 z-10 opacity-20"
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
