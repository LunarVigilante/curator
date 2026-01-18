'use client'

import Link from 'next/link'
import { cn } from '@/lib/utils'
import { normalizePlatformName } from '@/lib/utils/platformIcons'
import {
    WindowsIcon, AppleIcon, LinuxIcon, SteamIcon,
    PlayStationIcon, XboxIcon,
    NintendoSwitchIcon, NintendoIcon, WiiIcon,
    AndroidIcon, IOSIcon,
    SegaIcon, AtariIcon,
    ArcadeIcon, VRIcon, GlobeIcon, GamepadIcon, MonitorIcon
} from '@/components/icons/PlatformIcons'

// Icon component mapping by normalized platform name
const PLATFORM_ICON_MAP: Record<string, React.FC<{ className?: string; size?: number }>> = {
    // PC
    'PC': WindowsIcon,
    'Linux': LinuxIcon,
    'macOS': AppleIcon,
    'Steam': SteamIcon,

    // PlayStation
    'PS1': PlayStationIcon,
    'PS2': PlayStationIcon,
    'PS3': PlayStationIcon,
    'PS4': PlayStationIcon,
    'PS5': PlayStationIcon,
    'PSP': PlayStationIcon,
    'PS Vita': PlayStationIcon,

    // Xbox
    'Xbox': XboxIcon,
    'Xbox 360': XboxIcon,
    'Xbox One': XboxIcon,
    'Xbox Series X': XboxIcon,

    // Nintendo Consoles
    'NES': NintendoIcon,
    'SNES': NintendoIcon,
    'N64': NintendoIcon,
    'GameCube': NintendoIcon,
    'Wii': WiiIcon,
    'Wii U': NintendoIcon,
    'Switch': NintendoSwitchIcon,
    'Switch 2': NintendoSwitchIcon,

    // Nintendo Handhelds
    'Game Boy': NintendoIcon,
    'Game Boy Color': NintendoIcon,
    'GBA': NintendoIcon,
    'DS': NintendoIcon,
    '3DS': NintendoIcon,

    // Sega
    'Master System': SegaIcon,
    'Genesis': SegaIcon,
    'Saturn': SegaIcon,
    'Dreamcast': SegaIcon,
    'Sega CD': SegaIcon,
    'Sega 32X': SegaIcon,
    'Game Gear': SegaIcon,

    // Atari
    'Atari 2600': AtariIcon,
    'Atari 5200': AtariIcon,
    'Atari 7800': AtariIcon,
    'Atari Lynx': AtariIcon,
    'Atari Jaguar': AtariIcon,
    'Atari ST': AtariIcon,

    // Mobile
    'Android': AndroidIcon,
    'iOS': IOSIcon,

    // Other
    'Arcade': ArcadeIcon,
    'VR': VRIcon,
    'Web': GlobeIcon,
    'Neo Geo': GamepadIcon,
    'TurboGrafx-16': GamepadIcon,
    '3DO': GamepadIcon,
    'CD-i': GamepadIcon,
    'C64': MonitorIcon,
    'Amiga': MonitorIcon,
}

// Brand colors for platforms
const PLATFORM_COLORS: Record<string, { color: string; bgColor: string }> = {
    // PC
    'PC': { color: '#00A4EF', bgColor: 'bg-blue-500/10' },
    'Linux': { color: '#FCC624', bgColor: 'bg-yellow-500/10' },
    'macOS': { color: '#A2AAAD', bgColor: 'bg-zinc-500/10' },
    'Steam': { color: '#1B2838', bgColor: 'bg-zinc-700/10' },

    // PlayStation (Blue)
    'PS1': { color: '#003087', bgColor: 'bg-blue-700/10' },
    'PS2': { color: '#003087', bgColor: 'bg-blue-700/10' },
    'PS3': { color: '#003087', bgColor: 'bg-blue-700/10' },
    'PS4': { color: '#003087', bgColor: 'bg-blue-700/10' },
    'PS5': { color: '#003087', bgColor: 'bg-blue-700/10' },
    'PSP': { color: '#003087', bgColor: 'bg-blue-700/10' },
    'PS Vita': { color: '#003087', bgColor: 'bg-blue-700/10' },

    // Xbox (Green)
    'Xbox': { color: '#107C10', bgColor: 'bg-green-600/10' },
    'Xbox 360': { color: '#107C10', bgColor: 'bg-green-600/10' },
    'Xbox One': { color: '#107C10', bgColor: 'bg-green-600/10' },
    'Xbox Series X': { color: '#107C10', bgColor: 'bg-green-600/10' },

    // Nintendo (Red)
    'NES': { color: '#E60012', bgColor: 'bg-red-600/10' },
    'SNES': { color: '#8F8F8F', bgColor: 'bg-zinc-500/10' },
    'N64': { color: '#E60012', bgColor: 'bg-red-600/10' },
    'GameCube': { color: '#6B5B95', bgColor: 'bg-purple-600/10' },
    'Wii': { color: '#8B8B8B', bgColor: 'bg-zinc-500/10' },
    'Wii U': { color: '#009AC7', bgColor: 'bg-cyan-500/10' },
    'Switch': { color: '#E60012', bgColor: 'bg-red-600/10' },
    'Switch 2': { color: '#E60012', bgColor: 'bg-red-600/10' },
    'Game Boy': { color: '#8B956D', bgColor: 'bg-green-700/10' },
    'Game Boy Color': { color: '#6B5B95', bgColor: 'bg-purple-600/10' },
    'GBA': { color: '#6B5B95', bgColor: 'bg-purple-600/10' },
    'DS': { color: '#C0C0C0', bgColor: 'bg-zinc-400/10' },
    '3DS': { color: '#D12228', bgColor: 'bg-red-500/10' },

    // Sega (Blue)
    'Master System': { color: '#17569B', bgColor: 'bg-blue-600/10' },
    'Genesis': { color: '#17569B', bgColor: 'bg-blue-600/10' },
    'Saturn': { color: '#17569B', bgColor: 'bg-blue-600/10' },
    'Dreamcast': { color: '#FF6600', bgColor: 'bg-orange-500/10' },
    'Sega CD': { color: '#17569B', bgColor: 'bg-blue-600/10' },
    'Sega 32X': { color: '#17569B', bgColor: 'bg-blue-600/10' },
    'Game Gear': { color: '#17569B', bgColor: 'bg-blue-600/10' },

    // Atari (Red)
    'Atari 2600': { color: '#E4002B', bgColor: 'bg-red-600/10' },
    'Atari 5200': { color: '#E4002B', bgColor: 'bg-red-600/10' },
    'Atari 7800': { color: '#E4002B', bgColor: 'bg-red-600/10' },
    'Atari Lynx': { color: '#E4002B', bgColor: 'bg-red-600/10' },
    'Atari Jaguar': { color: '#E4002B', bgColor: 'bg-red-600/10' },
    'Atari ST': { color: '#E4002B', bgColor: 'bg-red-600/10' },

    // Mobile
    'Android': { color: '#3DDC84', bgColor: 'bg-green-500/10' },
    'iOS': { color: '#A2AAAD', bgColor: 'bg-zinc-500/10' },

    // Other
    'Arcade': { color: '#FFD700', bgColor: 'bg-yellow-500/10' },
    'VR': { color: '#1C1E20', bgColor: 'bg-zinc-800/10' },
    'Web': { color: '#4285F4', bgColor: 'bg-blue-500/10' },
    'Neo Geo': { color: '#FFD700', bgColor: 'bg-yellow-500/10' },
    'TurboGrafx-16': { color: '#FF6600', bgColor: 'bg-orange-500/10' },
    '3DO': { color: '#000000', bgColor: 'bg-zinc-800/10' },
    'CD-i': { color: '#005DAA', bgColor: 'bg-blue-600/10' },
    'C64': { color: '#7B68EE', bgColor: 'bg-purple-500/10' },
    'Amiga': { color: '#FF6600', bgColor: 'bg-orange-500/10' },
}

// Default for unknown platforms
const DEFAULT_STYLE = { color: '#6B7280', bgColor: 'bg-zinc-600/10' }

interface PlatformBadgeProps {
    platform: string
    category?: string
    showIcon?: boolean
    size?: 'sm' | 'md'
    className?: string
}

/**
 * A platform badge with brand SVG icon and colors
 */
export function PlatformBadge({
    platform,
    category = 'games',
    showIcon = true,
    size = 'sm',
    className
}: PlatformBadgeProps) {
    const normalized = normalizePlatformName(platform)
    const IconComponent = PLATFORM_ICON_MAP[normalized] || GamepadIcon
    const style = PLATFORM_COLORS[normalized] || DEFAULT_STYLE

    // Build the URL with the filter parameter
    const params = new URLSearchParams()
    params.set('platform', platform)
    if (category) {
        params.set('category', category)
    }

    const sizeClasses = size === 'sm'
        ? 'px-2 py-0.5 text-[11px] gap-1'
        : 'px-2.5 py-1 text-xs gap-1.5'

    const iconSize = size === 'sm' ? 12 : 14

    return (
        <Link
            href={`/admin/data-browser?${params.toString()}`}
            className={cn(
                "inline-flex items-center font-medium rounded-full",
                "border transition-all duration-150 cursor-pointer",
                style.bgColor,
                "hover:brightness-125",
                sizeClasses,
                className
            )}
            style={{
                borderColor: `${style.color}40`,
                color: style.color
            }}
        >
            {showIcon && <IconComponent size={iconSize} />}
            <span>{normalized}</span>
        </Link>
    )
}

/**
 * A list of PlatformBadges with optional limit
 */
export function PlatformBadgeList({
    platforms,
    category = 'games',
    showIcons = true,
    size = 'sm',
    limit = 6
}: {
    platforms: string[] | null
    category?: string
    showIcons?: boolean
    size?: 'sm' | 'md'
    limit?: number
}) {
    if (!platforms || platforms.length === 0) return null

    return (
        <div className="flex flex-wrap gap-1.5">
            {platforms.slice(0, limit).map((platform, i) => (
                <PlatformBadge
                    key={i}
                    platform={platform}
                    category={category}
                    showIcon={showIcons}
                    size={size}
                />
            ))}
            {platforms.length > limit && (
                <span className="inline-flex items-center px-2 py-0.5 text-[11px] font-medium rounded-full bg-zinc-900 text-zinc-500 border border-zinc-800">
                    +{platforms.length - limit} more
                </span>
            )}
        </div>
    )
}
