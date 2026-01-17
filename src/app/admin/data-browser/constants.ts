import {
    Film, Tv, Gamepad2, BookOpen, Music, Mic, Dice5, Sparkles
} from 'lucide-react'
import { CATEGORY_TYPES } from '@/lib/constants'

export const CATEGORY_ICONS: Record<string, { icon: React.ElementType; color: string; label: string }> = {
    [CATEGORY_TYPES.MOVIE]: { icon: Film, color: 'text-blue-400', label: 'Movies' },
    [CATEGORY_TYPES.TV_SHOW]: { icon: Tv, color: 'text-purple-400', label: 'TV Shows' },
    [CATEGORY_TYPES.ANIME]: { icon: Sparkles, color: 'text-pink-400', label: 'Anime' },
    [CATEGORY_TYPES.BOARD_GAME]: { icon: Dice5, color: 'text-orange-400', label: 'Board Games' },
    [CATEGORY_TYPES.VIDEO_GAME]: { icon: Gamepad2, color: 'text-green-400', label: 'Video Games' },
    [CATEGORY_TYPES.BOOKS]: { icon: BookOpen, color: 'text-yellow-400', label: 'Books' },
    'BOOK': { icon: BookOpen, color: 'text-yellow-400', label: 'Books' }, // Fallback
    [CATEGORY_TYPES.MUSIC_ARTIST]: { icon: Music, color: 'text-emerald-400', label: 'Artists' },
    [CATEGORY_TYPES.ALBUM]: { icon: Music, color: 'text-teal-400', label: 'Albums' },
    'MUSIC_ALBUM': { icon: Music, color: 'text-teal-400', label: 'Albums' }, // Fallback for DB
    [CATEGORY_TYPES.MUSIC_TRACK]: { icon: Music, color: 'text-cyan-400', label: 'Tracks' },
    [CATEGORY_TYPES.PODCAST]: { icon: Mic, color: 'text-red-400', label: 'Podcasts' },
    [CATEGORY_TYPES.COMICS]: { icon: BookOpen, color: 'text-amber-400', label: 'Comics' },
    [CATEGORY_TYPES.MANGA]: { icon: BookOpen, color: 'text-rose-400', label: 'Manga' },
    [CATEGORY_TYPES.LIGHT_NOVEL]: { icon: BookOpen, color: 'text-indigo-400', label: 'Light Novels' },
}
