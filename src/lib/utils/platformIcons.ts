/**
 * Platform icon mapping for gaming consoles and systems
 * Uses SVG paths for crisp rendering at any size
 */

// Platform name normalization - maps various IGDB names to our canonical names
export const PLATFORM_ALIASES: Record<string, string> = {
    // PC
    'pc': 'PC',
    'pc (microsoft windows)': 'PC',
    'windows': 'PC',
    'microsoft windows': 'PC',
    'dos': 'PC',
    'linux': 'Linux',
    'mac': 'macOS',
    'macos': 'macOS',
    'classic macintosh': 'macOS',

    // PlayStation
    'playstation': 'PS1',
    'playstation 1': 'PS1',
    'ps1': 'PS1',
    'psx': 'PS1',
    'playstation 2': 'PS2',
    'ps2': 'PS2',
    'playstation 3': 'PS3',
    'ps3': 'PS3',
    'playstation 4': 'PS4',
    'ps4': 'PS4',
    'playstation 5': 'PS5',
    'ps5': 'PS5',
    'playstation portable': 'PSP',
    'psp': 'PSP',
    'playstation vita': 'PS Vita',
    'ps vita': 'PS Vita',
    'vita': 'PS Vita',

    // Xbox
    'xbox': 'Xbox',
    'xbox 360': 'Xbox 360',
    'xbox one': 'Xbox One',
    'xbox series x': 'Xbox Series X',
    'xbox series s': 'Xbox Series X',
    'xbox series x|s': 'Xbox Series X',
    'xbox series': 'Xbox Series X',

    // Nintendo
    'nintendo entertainment system': 'NES',
    'nes': 'NES',
    'famicom': 'NES',
    'super nintendo entertainment system': 'SNES',
    'snes': 'SNES',
    'super famicom': 'SNES',
    'nintendo 64': 'N64',
    'n64': 'N64',
    'gamecube': 'GameCube',
    'nintendo gamecube': 'GameCube',
    'wii': 'Wii',
    'nintendo wii': 'Wii',
    'wii u': 'Wii U',
    'nintendo wii u': 'Wii U',
    'nintendo switch': 'Switch',
    'switch': 'Switch',
    'nintendo switch 2': 'Switch 2',
    'switch 2': 'Switch 2',

    // Nintendo Handhelds
    'game boy': 'Game Boy',
    'gameboy': 'Game Boy',
    'game boy color': 'Game Boy Color',
    'gbc': 'Game Boy Color',
    'game boy advance': 'GBA',
    'gba': 'GBA',
    'nintendo ds': 'DS',
    'ds': 'DS',
    'nintendo 3ds': '3DS',
    '3ds': '3DS',
    'new nintendo 3ds': '3DS',

    // Sega
    'sega master system': 'Master System',
    'master system': 'Master System',
    'sega genesis': 'Genesis',
    'genesis': 'Genesis',
    'mega drive': 'Genesis',
    'sega mega drive': 'Genesis',
    'sega saturn': 'Saturn',
    'saturn': 'Saturn',
    'sega dreamcast': 'Dreamcast',
    'dreamcast': 'Dreamcast',
    'sega cd': 'Sega CD',
    'sega 32x': 'Sega 32X',
    'sega game gear': 'Game Gear',
    'game gear': 'Game Gear',

    // Atari
    'atari 2600': 'Atari 2600',
    'atari': 'Atari 2600',
    'atari 5200': 'Atari 5200',
    'atari 7800': 'Atari 7800',
    'atari lynx': 'Atari Lynx',
    'atari jaguar': 'Atari Jaguar',
    'jaguar': 'Atari Jaguar',
    'atari st': 'Atari ST',

    // Other
    'android': 'Android',
    'ios': 'iOS',
    'web browser': 'Web',
    'browser': 'Web',
    'arcade': 'Arcade',
    'neo geo': 'Neo Geo',
    'turbografx-16': 'TurboGrafx-16',
    'pc engine': 'TurboGrafx-16',
    '3do': '3DO',
    'philips cd-i': 'CD-i',
    'commodore 64': 'C64',
    'c64': 'C64',
    'amiga': 'Amiga',
    'steam': 'Steam',
    'oculus quest': 'VR',
    'oculus rift': 'VR',
    'playstation vr': 'VR',
    'meta quest': 'VR',
    'steamvr': 'VR',
    'virtual reality': 'VR',
};

// Icon configuration with colors and SVG paths
export interface PlatformIconConfig {
    name: string;
    color: string;        // Brand color
    bgColor: string;      // Background for dark mode
    icon: string;         // Lucide icon name OR 'custom'
    customSvg?: string;   // Custom SVG path if icon is 'custom'
}

export const PLATFORM_ICONS: Record<string, PlatformIconConfig> = {
    // PC & Computer
    'PC': { name: 'PC', color: '#00A4EF', bgColor: 'bg-blue-500/10', icon: 'Monitor' },
    'Linux': { name: 'Linux', color: '#FCC624', bgColor: 'bg-yellow-500/10', icon: 'Terminal' },
    'macOS': { name: 'macOS', color: '#A2AAAD', bgColor: 'bg-zinc-500/10', icon: 'Apple' },
    'Steam': { name: 'Steam', color: '#1B2838', bgColor: 'bg-zinc-700/10', icon: 'Gamepad2' },

    // PlayStation Family
    'PS1': { name: 'PS1', color: '#003087', bgColor: 'bg-blue-700/10', icon: 'Gamepad2' },
    'PS2': { name: 'PS2', color: '#003087', bgColor: 'bg-blue-700/10', icon: 'Gamepad2' },
    'PS3': { name: 'PS3', color: '#003087', bgColor: 'bg-blue-700/10', icon: 'Gamepad2' },
    'PS4': { name: 'PS4', color: '#003087', bgColor: 'bg-blue-700/10', icon: 'Gamepad2' },
    'PS5': { name: 'PS5', color: '#003087', bgColor: 'bg-blue-700/10', icon: 'Gamepad2' },
    'PSP': { name: 'PSP', color: '#003087', bgColor: 'bg-blue-700/10', icon: 'Smartphone' },
    'PS Vita': { name: 'PS Vita', color: '#003087', bgColor: 'bg-blue-700/10', icon: 'Smartphone' },

    // Xbox Family
    'Xbox': { name: 'Xbox', color: '#107C10', bgColor: 'bg-green-600/10', icon: 'Gamepad2' },
    'Xbox 360': { name: 'Xbox 360', color: '#107C10', bgColor: 'bg-green-600/10', icon: 'Gamepad2' },
    'Xbox One': { name: 'Xbox One', color: '#107C10', bgColor: 'bg-green-600/10', icon: 'Gamepad2' },
    'Xbox Series X': { name: 'Xbox Series X', color: '#107C10', bgColor: 'bg-green-600/10', icon: 'Gamepad2' },

    // Nintendo Consoles
    'NES': { name: 'NES', color: '#E60012', bgColor: 'bg-red-600/10', icon: 'Gamepad2' },
    'SNES': { name: 'SNES', color: '#8F8F8F', bgColor: 'bg-zinc-500/10', icon: 'Gamepad2' },
    'N64': { name: 'N64', color: '#E60012', bgColor: 'bg-red-600/10', icon: 'Gamepad2' },
    'GameCube': { name: 'GameCube', color: '#6B5B95', bgColor: 'bg-purple-600/10', icon: 'Gamepad2' },
    'Wii': { name: 'Wii', color: '#8B8B8B', bgColor: 'bg-zinc-500/10', icon: 'Gamepad2' },
    'Wii U': { name: 'Wii U', color: '#009AC7', bgColor: 'bg-cyan-500/10', icon: 'Gamepad2' },
    'Switch': { name: 'Switch', color: '#E60012', bgColor: 'bg-red-600/10', icon: 'Gamepad2' },
    'Switch 2': { name: 'Switch 2', color: '#E60012', bgColor: 'bg-red-600/10', icon: 'Gamepad2' },

    // Nintendo Handhelds
    'Game Boy': { name: 'Game Boy', color: '#8B956D', bgColor: 'bg-green-700/10', icon: 'Smartphone' },
    'Game Boy Color': { name: 'GBC', color: '#6B5B95', bgColor: 'bg-purple-600/10', icon: 'Smartphone' },
    'GBA': { name: 'GBA', color: '#6B5B95', bgColor: 'bg-purple-600/10', icon: 'Smartphone' },
    'DS': { name: 'DS', color: '#C0C0C0', bgColor: 'bg-zinc-400/10', icon: 'Smartphone' },
    '3DS': { name: '3DS', color: '#D12228', bgColor: 'bg-red-500/10', icon: 'Smartphone' },

    // Sega
    'Master System': { name: 'Master System', color: '#17569B', bgColor: 'bg-blue-600/10', icon: 'Gamepad2' },
    'Genesis': { name: 'Genesis', color: '#17569B', bgColor: 'bg-blue-600/10', icon: 'Gamepad2' },
    'Saturn': { name: 'Saturn', color: '#17569B', bgColor: 'bg-blue-600/10', icon: 'Gamepad2' },
    'Dreamcast': { name: 'Dreamcast', color: '#FF6600', bgColor: 'bg-orange-500/10', icon: 'Gamepad2' },
    'Sega CD': { name: 'Sega CD', color: '#17569B', bgColor: 'bg-blue-600/10', icon: 'Disc' },
    'Sega 32X': { name: '32X', color: '#17569B', bgColor: 'bg-blue-600/10', icon: 'Gamepad2' },
    'Game Gear': { name: 'Game Gear', color: '#17569B', bgColor: 'bg-blue-600/10', icon: 'Smartphone' },

    // Atari
    'Atari 2600': { name: 'Atari 2600', color: '#E4002B', bgColor: 'bg-red-600/10', icon: 'Gamepad2' },
    'Atari 5200': { name: 'Atari 5200', color: '#E4002B', bgColor: 'bg-red-600/10', icon: 'Gamepad2' },
    'Atari 7800': { name: 'Atari 7800', color: '#E4002B', bgColor: 'bg-red-600/10', icon: 'Gamepad2' },
    'Atari Lynx': { name: 'Lynx', color: '#E4002B', bgColor: 'bg-red-600/10', icon: 'Smartphone' },
    'Atari Jaguar': { name: 'Jaguar', color: '#E4002B', bgColor: 'bg-red-600/10', icon: 'Gamepad2' },
    'Atari ST': { name: 'Atari ST', color: '#E4002B', bgColor: 'bg-red-600/10', icon: 'Monitor' },

    // Other Consoles
    'Neo Geo': { name: 'Neo Geo', color: '#FFD700', bgColor: 'bg-yellow-500/10', icon: 'Gamepad2' },
    'TurboGrafx-16': { name: 'TG-16', color: '#FF6600', bgColor: 'bg-orange-500/10', icon: 'Gamepad2' },
    '3DO': { name: '3DO', color: '#000000', bgColor: 'bg-zinc-800/10', icon: 'Gamepad2' },
    'CD-i': { name: 'CD-i', color: '#005DAA', bgColor: 'bg-blue-600/10', icon: 'Disc' },
    'C64': { name: 'C64', color: '#7B68EE', bgColor: 'bg-purple-500/10', icon: 'Monitor' },
    'Amiga': { name: 'Amiga', color: '#FF6600', bgColor: 'bg-orange-500/10', icon: 'Monitor' },
    'Arcade': { name: 'Arcade', color: '#FFD700', bgColor: 'bg-yellow-500/10', icon: 'Joystick' },

    // Mobile & Web
    'Android': { name: 'Android', color: '#3DDC84', bgColor: 'bg-green-500/10', icon: 'Smartphone' },
    'iOS': { name: 'iOS', color: '#A2AAAD', bgColor: 'bg-zinc-500/10', icon: 'Smartphone' },
    'Web': { name: 'Web', color: '#4285F4', bgColor: 'bg-blue-500/10', icon: 'Globe' },

    // VR
    'VR': { name: 'VR', color: '#1C1E20', bgColor: 'bg-zinc-800/10', icon: 'Glasses' },

    // Default
    'Unknown': { name: 'Unknown', color: '#6B7280', bgColor: 'bg-zinc-600/10', icon: 'Gamepad2' },
};

/**
 * Get the canonical platform name from a raw IGDB platform string
 */
export function normalizePlatformName(rawName: string): string {
    const lower = rawName.toLowerCase().trim();
    return PLATFORM_ALIASES[lower] || rawName;
}

/**
 * Get platform icon configuration
 */
export function getPlatformIcon(platformName: string): PlatformIconConfig {
    const normalized = normalizePlatformName(platformName);
    return PLATFORM_ICONS[normalized] || PLATFORM_ICONS['Unknown'];
}

/**
 * Get all known platforms (for display in filters, etc.)
 */
export function getAllPlatforms(): string[] {
    return Object.keys(PLATFORM_ICONS).filter(k => k !== 'Unknown');
}
