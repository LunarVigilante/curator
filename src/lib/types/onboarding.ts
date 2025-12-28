// ============================================================================
// ONBOARDING TYPES & DATA
// ============================================================================

// ============================================================================
// CALIBRATION QUESTIONS
// ============================================================================

export interface CalibrationQuestion {
    id: string
    step: number
    category: 'film' | 'anime' | 'games' | 'general'
    prompt: string
    optionA: CalibrationOption
    optionB: CalibrationOption
}

export interface CalibrationOption {
    label: string
    value: string
    emoji: string
    imageUrl?: string
    mapsToTemplates: string[]
}

// ============================================================================
// STARTER TEMPLATES
// ============================================================================

export interface StarterTemplate {
    id: string
    name: string
    description: string
    emoji: string
    color: string
    categoryType: 'MOVIE' | 'ANIME' | 'GAME' | 'TV'
    weight: number
    items: StarterItem[]
}

export interface StarterItem {
    name: string
    description?: string
    imageUrl: string
    releaseYear: number
    director?: string
    studio?: string
    genre: string[]
    externalId?: string
    defaultTier: 'S' | 'A' | 'B' | null
}

// ============================================================================
// BINARY RATER
// ============================================================================

export interface BinaryRaterPair {
    id: string
    theme: string
    categoryType: 'MOVIE' | 'TV' | 'ANIME' | 'GAME'
    optionA: BinaryRaterItem
    optionB: BinaryRaterItem
}

export interface BinaryRaterItem {
    name: string
    imageUrl: string
    description?: string
    releaseYear?: number
    externalId?: string
}

export interface BinaryRaterVotePayload {
    pairId: string
    winnerId: 'A' | 'B'
    theme: string
    optionA: BinaryRaterItem
    optionB: BinaryRaterItem
}

export interface BinaryRaterResult {
    success: boolean
    categoryId: string
    winnerItemId: string
    loserItemId: string
}

// ============================================================================
// ONBOARDING STATE
// ============================================================================

export interface OnboardingState {
    currentStep: 'calibration' | 'binary' | 'complete'
    calibrationAnswers: CalibrationAnswer[]
    selectedTemplates: string[]
    binaryVoteComplete: boolean
}

export interface CalibrationAnswer {
    questionId: string
    selectedValue: string
}

// ============================================================================
// CALIBRATION QUESTIONS DATA
// ============================================================================

export const CALIBRATION_QUESTIONS: CalibrationQuestion[] = [
    {
        id: 'q1-scale',
        step: 1,
        category: 'film',
        prompt: 'What kind of films speak to you?',
        optionA: {
            label: 'Blockbusters',
            value: 'blockbuster',
            emoji: '🎬',
            imageUrl: 'https://image.tmdb.org/t/p/w500/or06FN3Dka5tukK1e9sl16pB3iy.jpg', // Avengers
            mapsToTemplates: ['mcu-ranking', 'action-epics', 'pixar-collection']
        },
        optionB: {
            label: 'Indie Films',
            value: 'indie',
            emoji: '🎭',
            imageUrl: 'https://image.tmdb.org/t/p/w500/w3LxiVYdWWRvEVdn5RYq6jIqkb1.jpg', // EEAAO
            mapsToTemplates: ['a24-essentials', 'arthouse-cinema', 'festival-favorites']
        }
    },
    {
        id: 'q2-genre',
        step: 2,
        category: 'film',
        prompt: 'Pick your favorite flavor of escapism.',
        optionA: {
            label: 'Sci-Fi',
            value: 'scifi',
            emoji: '🚀',
            imageUrl: 'https://image.tmdb.org/t/p/w500/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg', // Interstellar
            mapsToTemplates: ['scifi-classics', 'dystopian-futures', 'space-operas']
        },
        optionB: {
            label: 'Fantasy',
            value: 'fantasy',
            emoji: '⚔️',
            imageUrl: 'https://image.tmdb.org/t/p/w500/6oom5QYQ2yQTMJIbnvbkBL9cHo6.jpg', // LOTR
            mapsToTemplates: ['lotr-collection', 'mythic-cinema', 'epic-fantasy']
        }
    },
    {
        id: 'q3-anime',
        step: 3,
        category: 'anime',
        prompt: 'What\'s your anime vibe?',
        optionA: {
            label: 'Seinen',
            value: 'seinen',
            emoji: '🔪',
            imageUrl: 'https://cdn.myanimelist.net/images/anime/1286/99889l.jpg', // Vinland Saga
            mapsToTemplates: ['seinen-masterpieces', 'psychological-anime', 'dark-anime']
        },
        optionB: {
            label: 'Shonen',
            value: 'shonen',
            emoji: '⚡',
            imageUrl: 'https://cdn.myanimelist.net/images/anime/1208/94745l.jpg', // Demon Slayer
            mapsToTemplates: ['shonen-classics', 'battle-anime', 'action-anime']
        }
    }
]

// ============================================================================
// STARTER TEMPLATES DATA
// ============================================================================

export const STARTER_TEMPLATES: StarterTemplate[] = [
    {
        id: 'a24-essentials',
        name: 'A24 Essentials',
        description: 'The finest indie cinema of the decade',
        emoji: '🎭',
        color: '#E50914',
        categoryType: 'MOVIE',
        weight: 1,
        items: [
            {
                name: 'Everything Everywhere All at Once',
                description: 'A mind-bending multiverse adventure about a Chinese-American immigrant',
                imageUrl: 'https://image.tmdb.org/t/p/w500/w3LxiVYdWWRvEVdn5RYq6jIqkb1.jpg',
                releaseYear: 2022,
                director: 'Daniels',
                genre: ['Sci-Fi', 'Comedy', 'Drama'],
                externalId: 'tmdb-545611',
                defaultTier: null
            },
            {
                name: 'Hereditary',
                description: 'A terrifying descent into family trauma and the occult',
                imageUrl: 'https://image.tmdb.org/t/p/w500/lHV8HHlhwNup2VbpiACtlKzaGIQ.jpg',
                releaseYear: 2018,
                director: 'Ari Aster',
                genre: ['Horror', 'Drama'],
                externalId: 'tmdb-493922',
                defaultTier: null
            },
            {
                name: 'Moonlight',
                description: 'A young African-American man grapples with identity and sexuality',
                imageUrl: 'https://image.tmdb.org/t/p/w500/4911T5FbJ9eD2Faz5Z8cT3SUhU3.jpg',
                releaseYear: 2016,
                director: 'Barry Jenkins',
                genre: ['Drama'],
                externalId: 'tmdb-376867',
                defaultTier: null
            },
            {
                name: 'The Lighthouse',
                description: 'Two lighthouse keepers descend into madness on a remote island',
                imageUrl: 'https://image.tmdb.org/t/p/w500/3nk9UoepYmv1G9oP18q6JJCeYwN.jpg',
                releaseYear: 2019,
                director: 'Robert Eggers',
                genre: ['Horror', 'Drama'],
                externalId: 'tmdb-503919',
                defaultTier: null
            },
            {
                name: 'Lady Bird',
                description: 'A high school senior navigates family and identity in Sacramento',
                imageUrl: 'https://image.tmdb.org/t/p/w500/iySFtKLrWvVzXzlFj7x1zalxi5G.jpg',
                releaseYear: 2017,
                director: 'Greta Gerwig',
                genre: ['Comedy', 'Drama'],
                externalId: 'tmdb-391713',
                defaultTier: null
            }
        ]
    },
    {
        id: 'mcu-ranking',
        name: 'MCU Ranking',
        description: 'Rank the Marvel Cinematic Universe',
        emoji: '🦸',
        color: '#ED1D24',
        categoryType: 'MOVIE',
        weight: 1,
        items: [
            {
                name: 'Avengers: Endgame',
                description: 'The epic conclusion to the Infinity Saga',
                imageUrl: 'https://image.tmdb.org/t/p/w500/or06FN3Dka5tukK1e9sl16pB3iy.jpg',
                releaseYear: 2019,
                director: 'Russo Brothers',
                genre: ['Action', 'Sci-Fi'],
                externalId: 'tmdb-299534',
                defaultTier: null
            },
            {
                name: 'Guardians of the Galaxy',
                description: 'A group of intergalactic misfits become unlikely heroes',
                imageUrl: 'https://image.tmdb.org/t/p/w500/r7vmZjiyZw9rpJMQJdXpjgiCOk9.jpg',
                releaseYear: 2014,
                director: 'James Gunn',
                genre: ['Action', 'Comedy', 'Sci-Fi'],
                externalId: 'tmdb-118340',
                defaultTier: null
            },
            {
                name: 'Spider-Man: No Way Home',
                description: 'Peter Parker faces the multiverse',
                imageUrl: 'https://image.tmdb.org/t/p/w500/1g0dhYtq4irTY1GPXvft6k4YLjm.jpg',
                releaseYear: 2021,
                director: 'Jon Watts',
                genre: ['Action', 'Adventure'],
                externalId: 'tmdb-634649',
                defaultTier: null
            },
            {
                name: 'Iron Man',
                description: 'Genius billionaire Tony Stark becomes Iron Man',
                imageUrl: 'https://image.tmdb.org/t/p/w500/78lPtwv72eTNqFW9COBYI0dWDJa.jpg',
                releaseYear: 2008,
                director: 'Jon Favreau',
                genre: ['Action', 'Sci-Fi'],
                externalId: 'tmdb-1726',
                defaultTier: null
            },
            {
                name: 'Black Panther',
                description: 'T\'Challa returns home to take his place as King of Wakanda',
                imageUrl: 'https://image.tmdb.org/t/p/w500/uxzzxijgPIY7slzFvMotPv8wjKA.jpg',
                releaseYear: 2018,
                director: 'Ryan Coogler',
                genre: ['Action', 'Adventure'],
                externalId: 'tmdb-284054',
                defaultTier: null
            }
        ]
    },
    {
        id: 'seinen-masterpieces',
        name: 'Seinen Masterpieces',
        description: 'Dark, mature anime for sophisticated tastes',
        emoji: '🔪',
        color: '#4B0082',
        categoryType: 'ANIME',
        weight: 1,
        items: [
            {
                name: 'Vinland Saga',
                description: 'A young Viking seeks revenge against his father\'s killer',
                imageUrl: 'https://cdn.myanimelist.net/images/anime/1500/103005l.jpg',
                releaseYear: 2019,
                studio: 'Wit Studio',
                genre: ['Action', 'Drama', 'Historical'],
                defaultTier: null
            },
            {
                name: 'Monster',
                description: 'A doctor hunts a serial killer he once saved',
                imageUrl: 'https://cdn.myanimelist.net/images/anime/10/18793l.jpg',
                releaseYear: 2004,
                studio: 'Madhouse',
                genre: ['Psychological', 'Thriller', 'Mystery'],
                defaultTier: null
            },
            {
                name: 'Berserk',
                description: 'A lone mercenary struggles against fate in a dark medieval world',
                imageUrl: 'https://cdn.myanimelist.net/images/anime/1384/119988l.jpg',
                releaseYear: 1997,
                studio: 'OLM',
                genre: ['Action', 'Dark Fantasy', 'Horror'],
                defaultTier: null
            },
            {
                name: 'Steins;Gate',
                description: 'A group of friends accidentally create a time machine',
                imageUrl: 'https://cdn.myanimelist.net/images/anime/1935/127974l.jpg',
                releaseYear: 2011,
                studio: 'White Fox',
                genre: ['Sci-Fi', 'Thriller'],
                defaultTier: null
            }
        ]
    },
    {
        id: 'shonen-classics',
        name: 'Shonen Classics',
        description: 'Epic battles and unforgettable journeys',
        emoji: '⚡',
        color: '#FF6B00',
        categoryType: 'ANIME',
        weight: 1,
        items: [
            {
                name: 'Demon Slayer',
                description: 'A boy becomes a demon hunter to save his sister',
                imageUrl: 'https://cdn.myanimelist.net/images/anime/1286/99889l.jpg',
                releaseYear: 2019,
                studio: 'ufotable',
                genre: ['Action', 'Fantasy'],
                defaultTier: null
            },
            {
                name: 'Attack on Titan',
                description: 'Humanity fights for survival against giant humanoid Titans',
                imageUrl: 'https://cdn.myanimelist.net/images/anime/10/47347l.jpg',
                releaseYear: 2013,
                studio: 'Wit Studio',
                genre: ['Action', 'Drama', 'Dark Fantasy'],
                defaultTier: null
            },
            {
                name: 'My Hero Academia',
                description: 'A quirkless boy dreams of becoming a hero',
                imageUrl: 'https://cdn.myanimelist.net/images/anime/10/78745l.jpg',
                releaseYear: 2016,
                studio: 'Bones',
                genre: ['Action', 'Comedy', 'Superhero'],
                defaultTier: null
            },
            {
                name: 'Jujutsu Kaisen',
                description: 'A high schooler joins a secret organization of sorcerers',
                imageUrl: 'https://cdn.myanimelist.net/images/anime/1171/109222l.jpg',
                releaseYear: 2020,
                studio: 'MAPPA',
                genre: ['Action', 'Supernatural'],
                defaultTier: null
            }
        ]
    },
    {
        id: 'scifi-classics',
        name: 'Sci-Fi Classics',
        description: 'Mind-bending journeys through space and time',
        emoji: '🚀',
        color: '#1E3A5F',
        categoryType: 'MOVIE',
        weight: 1,
        items: [
            {
                name: 'Interstellar',
                description: 'A team of explorers travel through a wormhole to save humanity',
                imageUrl: 'https://image.tmdb.org/t/p/w500/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg',
                releaseYear: 2014,
                director: 'Christopher Nolan',
                genre: ['Sci-Fi', 'Adventure', 'Drama'],
                externalId: 'tmdb-157336',
                defaultTier: null
            },
            {
                name: 'Blade Runner 2049',
                description: 'A new blade runner uncovers a long-buried secret',
                imageUrl: 'https://image.tmdb.org/t/p/w500/gajva2L0rPYkEWjzgFlBXCAVBE5.jpg',
                releaseYear: 2017,
                director: 'Denis Villeneuve',
                genre: ['Sci-Fi', 'Drama'],
                externalId: 'tmdb-335984',
                defaultTier: null
            },
            {
                name: 'Arrival',
                description: 'A linguist is recruited to communicate with aliens',
                imageUrl: 'https://image.tmdb.org/t/p/w500/x2FJsf1ElAgr63Y3PNPtJrcmpoe.jpg',
                releaseYear: 2016,
                director: 'Denis Villeneuve',
                genre: ['Sci-Fi', 'Drama'],
                externalId: 'tmdb-329865',
                defaultTier: null
            },
            {
                name: 'Dune',
                description: 'A noble family becomes embroiled in a war for a desert planet',
                imageUrl: 'https://image.tmdb.org/t/p/w500/d5NXSklXo0qyIYkgV94XAgMIckC.jpg',
                releaseYear: 2021,
                director: 'Denis Villeneuve',
                genre: ['Sci-Fi', 'Adventure'],
                externalId: 'tmdb-438631',
                defaultTier: null
            }
        ]
    },
    {
        id: 'lotr-collection',
        name: 'Middle-earth Collection',
        description: 'The ultimate fantasy saga',
        emoji: '⚔️',
        color: '#8B4513',
        categoryType: 'MOVIE',
        weight: 1,
        items: [
            {
                name: 'The Lord of the Rings: The Fellowship of the Ring',
                description: 'A hobbit begins an epic quest to destroy a powerful ring',
                imageUrl: 'https://image.tmdb.org/t/p/w500/6oom5QYQ2yQTMJIbnvbkBL9cHo6.jpg',
                releaseYear: 2001,
                director: 'Peter Jackson',
                genre: ['Fantasy', 'Adventure'],
                externalId: 'tmdb-120',
                defaultTier: null
            },
            {
                name: 'The Lord of the Rings: The Two Towers',
                description: 'The fellowship is broken as the journey continues',
                imageUrl: 'https://image.tmdb.org/t/p/w500/5VTN0pR8gcqV3EPUHHfMGnJYN9L.jpg',
                releaseYear: 2002,
                director: 'Peter Jackson',
                genre: ['Fantasy', 'Adventure'],
                externalId: 'tmdb-121',
                defaultTier: null
            },
            {
                name: 'The Lord of the Rings: The Return of the King',
                description: 'The final battle for Middle-earth begins',
                imageUrl: 'https://image.tmdb.org/t/p/w500/rCzpDGLbOoPwLjy3OAm5NUPOTrC.jpg',
                releaseYear: 2003,
                director: 'Peter Jackson',
                genre: ['Fantasy', 'Adventure'],
                externalId: 'tmdb-122',
                defaultTier: null
            }
        ]
    }
]

// ============================================================================
// BINARY RATER PAIRS DATA
// ============================================================================

export const BINARY_RATER_PAIRS: BinaryRaterPair[] = [
    {
        id: 'cinematic-universes',
        theme: 'Best Cinematic Universes',
        categoryType: 'MOVIE',
        optionA: {
            name: 'Marvel Cinematic Universe',
            imageUrl: 'https://image.tmdb.org/t/p/w500/or06FN3Dka5tukK1e9sl16pB3iy.jpg',
            description: 'Earth\'s Mightiest Heroes unite',
            externalId: 'mcu-collection'
        },
        optionB: {
            name: 'DC Extended Universe',
            imageUrl: 'https://image.tmdb.org/t/p/w500/uxuzzV88crhGgLUw0Al7UGHvpAx.jpg',
            description: 'The World\'s Greatest Superheroes',
            externalId: 'dceu-collection'
        }
    },
    {
        id: 'prestige-tv',
        theme: 'Peak Television',
        categoryType: 'TV',
        optionA: {
            name: 'Succession',
            imageUrl: 'https://image.tmdb.org/t/p/w500/7HW47XbkNQ5fiwQFYGWdw9gs144.jpg',
            description: 'A family drama about media moguls',
            releaseYear: 2018,
            externalId: 'tmdb-tv-76331'
        },
        optionB: {
            name: 'The Bear',
            imageUrl: 'https://image.tmdb.org/t/p/w500/sHFlbKS3WLqMnp9t2ghADIJFnuQ.jpg',
            description: 'High-pressure kitchen chaos',
            releaseYear: 2022,
            externalId: 'tmdb-tv-136315'
        }
    },
    {
        id: 'anime-titans',
        theme: 'Anime Titans',
        categoryType: 'ANIME',
        optionA: {
            name: 'Attack on Titan',
            imageUrl: 'https://cdn.myanimelist.net/images/anime/10/47347l.jpg',
            description: 'Humanity fights for survival against Titans',
            releaseYear: 2013
        },
        optionB: {
            name: 'Demon Slayer',
            imageUrl: 'https://cdn.myanimelist.net/images/anime/1286/99889l.jpg',
            description: 'A boy becomes a demon hunter',
            releaseYear: 2019
        }
    },
    {
        id: 'studio-ghibli',
        theme: 'Studio Ghibli Favorites',
        categoryType: 'ANIME',
        optionA: {
            name: 'Spirited Away',
            imageUrl: 'https://image.tmdb.org/t/p/w500/39wmItIWsg5sZMyRUHLkWBcuVCM.jpg',
            description: 'A girl enters a world of spirits',
            releaseYear: 2001
        },
        optionB: {
            name: 'Princess Mononoke',
            imageUrl: 'https://image.tmdb.org/t/p/w500/jHWmNr7m544fJ8eItsfNk8fs2Ed.jpg',
            description: 'A prince caught between gods and humans',
            releaseYear: 1997
        }
    }
]
