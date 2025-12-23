export default function CategoryPlaceholder({
    name,
    color,
    emoji,
    backgroundImage,
    className = ''
}: {
    name: string
    color?: string | null
    emoji?: string | null
    backgroundImage?: string | null
    className?: string
}) {
    // Use provided color or generate from name hash
    const bgColor = color || generateColorFromString(name)

    // Create gradient for visual interest
    const gradient = `linear-gradient(135deg, ${bgColor} 0%, ${adjustBrightness(bgColor, -30)} 100%)`

    return (
        <div
            className={`relative w-full h-full overflow-hidden ${className}`}
            style={{
                background: backgroundImage ? undefined : gradient,
            }}
        >
            {backgroundImage && (
                <div
                    className="absolute inset-0 bg-cover bg-center transition-all duration-500 group-hover:scale-110 group-hover:brightness-110"
                    style={{ backgroundImage: `url(${backgroundImage})` }}
                />
            )}

            {/* Noise texture overlay for premium look */}
            {!backgroundImage && (
                <svg className="absolute inset-0 w-full h-full opacity-20 mix-blend-overlay pointer-events-none">
                    <filter id="noise">
                        <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="4" stitchTiles="stitch" />
                        <feColorMatrix type="saturate" values="0" />
                    </filter>
                    <rect width="100%" height="100%" filter="url(#noise)" />
                </svg>
            )}

            {/* Emoji display if provided */}
            {emoji && !backgroundImage && (
                <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-8xl filter drop-shadow-lg opacity-40 group-hover:opacity-60 transition-opacity duration-300">
                        {emoji}
                    </span>
                </div>
            )}
        </div>
    )
}

// Generate consistent color from string
function generateColorFromString(str: string): string {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash)
    }

    const hue = Math.abs(hash % 360)
    return `hsl(${hue}, 30%, 35%)`
}

// Adjust color brightness
function adjustBrightness(color: string, percent: number): string {
    // Simple brightness adjustment for hex colors
    if (color.startsWith('#')) {
        const num = parseInt(color.slice(1), 16)
        const amt = Math.round(2.55 * percent)
        const R = Math.min(255, Math.max(0, (num >> 16) + amt))
        const G = Math.min(255, Math.max(0, (num >> 8 & 0x00FF) + amt))
        const B = Math.min(255, Math.max(0, (num & 0x0000FF) + amt))
        return `#${(0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1)}`
    }

    // For HSL colors, adjust lightness
    if (color.startsWith('hsl')) {
        const match = color.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/)
        if (match) {
            const [, h, s, l] = match
            const newL = Math.min(100, Math.max(0, parseInt(l) + percent / 5))
            return `hsl(${h}, ${s}%, ${newL}%)`
        }
    }

    return color
}
