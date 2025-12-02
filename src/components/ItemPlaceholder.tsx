export default function ItemPlaceholder({
    name,
    className = '',
    size = 80
}: {
    name: string
    className?: string
    size?: number
}) {
    // Generate unique color from name
    const color = generateColorFromString(name)
    const gradient = `linear-gradient(135deg, ${color} 0%, ${adjustBrightness(color, -15)} 100%)`

    // Get first letter or emoji-like representation
    const initial = name[0]?.toUpperCase() || '?'

    return (
        <div
            className={`relative flex items-center justify-center rounded-sm ${className}`}
            style={{
                background: gradient,
                width: `${size}px`,
                height: `${size}px`
            }}
        >
            <div className="absolute inset-0 bg-black/10 rounded-sm" />
            <span className="relative text-white font-bold drop-shadow-md" style={{ fontSize: `${size * 0.5}px` }}>
                {initial}
            </span>
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
    const saturation = 65 + (Math.abs(hash) % 20) // 65-85%
    const lightness = 50 + (Math.abs(hash >> 8) % 15) // 50-65%

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
