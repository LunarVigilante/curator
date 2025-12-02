export default function CategoryPlaceholder({
    name,
    color,
    className = ''
}: {
    name: string
    color?: string | null
    className?: string
}) {
    // Use provided color or generate from name hash
    const bgColor = color || generateColorFromString(name)

    // Create gradient for visual interest
    const gradient = `linear-gradient(135deg, ${bgColor} 0%, ${adjustBrightness(bgColor, -20)} 100%)`

    // Get initials (first 2 letters or first letter of each word)
    const initials = name
        .split(' ')
        .map(word => word[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)

    return (
        <div
            className={`relative w-full h-full flex items-center justify-center ${className}`}
            style={{ background: gradient }}
        >
            <div className="absolute inset-0 bg-black/10" />
            <span className="relative text-white font-bold text-4xl drop-shadow-lg">
                {initials}
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

    const hue = Math.abs(hash % 360)
    return `hsl(${hue}, 70%, 55%)`
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
