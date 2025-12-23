import { ImageIcon } from 'lucide-react'

export default function ItemPlaceholder({
    name,
    className = '',
}: {
    name: string
    className?: string
}) {
    // Generate unique color from name
    const color = generateColorFromString(name)
    const gradient = `linear-gradient(135deg, ${color} 0%, ${adjustBrightness(color, -20)} 100%)`

    return (
        <div
            className={`relative flex items-center justify-center ${className}`}
            style={{
                background: gradient,
            }}
        >
            {/* Noise texture overlay */}
            <svg className="absolute inset-0 w-full h-full opacity-10 mix-blend-overlay pointer-events-none">
                <filter id={`noise-${name.replace(/\s/g, '')}`}>
                    <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="4" stitchTiles="stitch" />
                    <feColorMatrix type="saturate" values="0" />
                </filter>
                <rect width="100%" height="100%" filter={`url(#noise-${name.replace(/\s/g, '')})`} />
            </svg>

            {/* Icon placeholder */}
            <ImageIcon className="w-1/3 h-1/3 text-white/20" strokeWidth={1.5} />

            {/* Dark gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
        </div>
    )
}

// Generate consistent color from string
function generateColorFromString(str: string): string {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash)
    }

    // Generate vibrant colors with good saturation
    const hue = Math.abs(hash % 360)
    const saturation = 60 + (Math.abs(hash) % 15) // 60-75%
    const lightness = 40 + (Math.abs(hash >> 8) % 15) // 40-55%

    return `hsl(${hue}, ${saturation}%, ${lightness}%)`
}

// Adjust color brightness  
function adjustBrightness(color: string, percent: number): string {
    if (color.startsWith('hsl')) {
        const match = color.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/)
        if (match) {
            const [, h, s, l] = match
            const newL = Math.min(100, Math.max(0, parseInt(l) + percent / 3))
            return `hsl(${h}, ${s}%, ${newL}%)`
        }
    }
    return color
}
