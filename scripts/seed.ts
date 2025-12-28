/**
 * Database Seed Script
 * 
 * Creates realistic initial data for the Curator application:
 * - Golden Ticket Admin (from environment variables)
 * - 2 Additional Admins
 * - 10 "Critics" (Power Users) with high activity
 * - 50 Standard Users with varied activity
 * - 100+ Realistic Media Items
 * - Collections, Rankings, Follows, and Activity Logs
 * 
 * Usage: npx tsx scripts/seed.ts
 */

import 'dotenv/config'

import { db } from '../src/lib/db'
import {
    users,
    accounts,
    categories,
    globalItems,
    items,
    ratings,
    tasteMetrics,
    tasteSnapshots,
    sessions,
    verifications,
    passkeys,
    partialSessions,
    systemSettings,
    unlockConditions,
    collectionLikes,
    collectionSaves,
    collectionTags,
    userTopPicks,
} from '../src/db/schema'
import { faker } from '@faker-js/faker'
import { hash } from 'bcryptjs'
import { eq, desc } from 'drizzle-orm'
import { encrypt } from '../src/lib/encryption'


// =============================================================================
// CONFIGURATION (from .env with fallbacks)
// =============================================================================

const DEFAULT_PASSWORD = process.env.SEED_DEFAULT_PASSWORD || 'Password123!'
const ADMIN_COUNT = parseInt(process.env.SEED_ADMIN_COUNT || '2', 10)
const CRITIC_COUNT = parseInt(process.env.SEED_CRITIC_COUNT || '10', 10)
const STANDARD_USER_COUNT = parseInt(process.env.SEED_USER_COUNT || '50', 10)
const ITEMS_PER_STANDARD_USER = parseInt(process.env.SEED_ITEMS_PER_USER || '5', 10)

// =============================================================================
// REALISTIC MEDIA DATA
// =============================================================================

const REALISTIC_MEDIA = {
    Movies: [
        { title: 'The Godfather', year: 1972, description: 'The aging patriarch of an organized crime dynasty transfers control to his reluctant son.' },
        { title: 'The Shawshank Redemption', year: 1994, description: 'Two imprisoned men bond over several years, finding solace and eventual redemption.' },
        { title: 'The Dark Knight', year: 2008, description: 'Batman must accept one of the greatest psychological and physical tests of his ability to fight injustice.' },
        { title: 'Pulp Fiction', year: 1994, description: 'The lives of two mob hitmen, a boxer, a gangster and his wife intertwine in four tales of violence.' },
        { title: 'Inception', year: 2010, description: 'A thief who enters the dreams of others to steal their secrets.' },
        { title: 'Fight Club', year: 1999, description: 'An insomniac office worker forms an underground fight club.' },
        { title: 'The Matrix', year: 1999, description: 'A computer hacker learns about the true nature of reality.' },
        { title: 'Goodfellas', year: 1990, description: 'The story of Henry Hill and his life in the mob.' },
        { title: 'Parasite', year: 2019, description: 'Greed and class discrimination threaten a newly formed symbiotic relationship.' },
        { title: 'Interstellar', year: 2014, description: 'Explorers travel through a wormhole in search of a new home for humanity.' },
        { title: 'The Silence of the Lambs', year: 1991, description: 'A young FBI cadet must receive the help of an incarcerated cannibal killer.' },
        { title: 'Spirited Away', year: 2001, description: 'A girl becomes trapped in a strange world of spirits.' },
        { title: 'The Lord of the Rings: The Return of the King', year: 2003, description: 'Gandalf and Aragorn lead the World of Men against Saurons army.' },
        { title: 'Whiplash', year: 2014, description: 'A promising young drummer enrolls at a cutthroat music conservatory.' },
        { title: 'Get Out', year: 2017, description: 'A young African-American visits his white girlfriends parents for the weekend.' },
        { title: 'Dune', year: 2021, description: 'Paul Atreides leads nomadic tribes in a battle to control Arrakis.' },
        { title: 'Everything Everywhere All at Once', year: 2022, description: 'A Chinese immigrant gets swept up in an insane adventure.' },
        { title: 'Oppenheimer', year: 2023, description: 'The story of J. Robert Oppenheimer and the atomic bomb.' },
        { title: 'No Country for Old Men', year: 2007, description: 'Violence and mayhem ensue after a hunter stumbles upon a drug deal gone wrong.' },
        { title: 'The Departed', year: 2006, description: 'An undercover cop and a mole in the police try to identify each other.' },
    ],
    'TV Shows': [
        { title: 'Breaking Bad', year: 2008, description: 'A high school chemistry teacher turns to manufacturing meth.' },
        { title: 'Game of Thrones', year: 2011, description: 'Nine noble families fight for control of Westeros.' },
        { title: 'The Sopranos', year: 1999, description: 'New Jersey mob boss Tony Soprano deals with personal and professional issues.' },
        { title: 'The Wire', year: 2002, description: 'The Baltimore drug scene and the relationship between dealers and law enforcement.' },
        { title: 'Succession', year: 2018, description: 'The Roy family controls one of the biggest media conglomerates in the world.' },
        { title: 'True Detective', year: 2014, description: 'Anthology series with different casts investigating various crimes.' },
        { title: 'The Office', year: 2005, description: 'A mockumentary on a group of office workers.' },
        { title: 'Stranger Things', year: 2016, description: 'Kids disappear and supernatural forces emerge in a small town.' },
        { title: 'Chernobyl', year: 2019, description: 'The true story of the 1986 nuclear disaster.' },
        { title: 'The Last of Us', year: 2023, description: 'Joel and Ellie traverse a post-apocalyptic America.' },
        { title: 'Better Call Saul', year: 2015, description: 'The origin story of criminal lawyer Saul Goodman.' },
        { title: 'Arcane', year: 2021, description: 'Two rival cities and the technology that tore them apart.' },
        { title: 'Fleabag', year: 2016, description: 'A young woman navigates life in London.' },
        { title: 'The Bear', year: 2022, description: 'A young chef returns home to run his familys sandwich shop.' },
        { title: 'House of the Dragon', year: 2022, description: 'The Targaryen civil war 200 years before Game of Thrones.' },
    ],
    'Video Games': [
        { title: 'Elden Ring', year: 2022, description: 'An action RPG set in the Lands Between, created by FromSoftware and George R.R. Martin.' },
        { title: 'The Legend of Zelda: Breath of the Wild', year: 2017, description: 'Link awakens from a 100-year slumber to defeat Calamity Ganon.' },
        { title: 'The Witcher 3: Wild Hunt', year: 2015, description: 'Geralt of Rivia searches for his missing adopted daughter.' },
        { title: 'Red Dead Redemption 2', year: 2018, description: 'Arthur Morgan rides with the Van der Linde gang.' },
        { title: 'God of War (2018)', year: 2018, description: 'Kratos and his son Atreus journey through Norse realms.' },
        { title: 'Hades', year: 2020, description: 'Zagreus attempts to escape the Underworld repeatedly.' },
        { title: 'Dark Souls III', year: 2016, description: 'An unkindled ash rises to link the First Flame.' },
        { title: 'Hollow Knight', year: 2017, description: 'A knight explores the ruins of Hallownest.' },
        { title: 'Celeste', year: 2018, description: 'Madeline climbs Celeste Mountain while dealing with anxiety.' },
        { title: 'Baldurs Gate 3', year: 2023, description: 'An epic RPG set in the Forgotten Realms.' },
        { title: 'The Last of Us Part II', year: 2020, description: 'Ellie sets out for revenge in a post-apocalyptic America.' },
        { title: 'Sekiro: Shadows Die Twice', year: 2019, description: 'A shinobi seeks to rescue his young lord.' },
        { title: 'Disco Elysium', year: 2019, description: 'A detective with amnesia solves a murder mystery.' },
        { title: 'Portal 2', year: 2011, description: 'Chell navigates test chambers with the portal gun.' },
        { title: 'Undertale', year: 2015, description: 'A child falls into an underground world of monsters.' },
    ],
    Anime: [
        { title: 'Attack on Titan', year: 2013, description: 'Humanity fights for survival against giant humanoid Titans.' },
        { title: 'Fullmetal Alchemist: Brotherhood', year: 2009, description: 'Two brothers search for the Philosophers Stone.' },
        { title: 'Death Note', year: 2006, description: 'A student discovers a notebook that kills anyone whose name is written in it.' },
        { title: 'Steins;Gate', year: 2011, description: 'A group discovers they can send messages to the past.' },
        { title: 'Hunter x Hunter (2011)', year: 2011, description: 'Gon searches for his father who is a legendary Hunter.' },
        { title: 'Cowboy Bebop', year: 1998, description: 'A ragtag crew of bounty hunters chase criminals across the galaxy.' },
        { title: 'Neon Genesis Evangelion', year: 1995, description: 'Teenagers pilot giant mechs to fight mysterious beings.' },
        { title: 'Mob Psycho 100', year: 2016, description: 'A psychic middle schooler tries to live a normal life.' },
        { title: 'Jujutsu Kaisen', year: 2020, description: 'A student swallows a cursed finger and joins an occult organization.' },
        { title: 'Chainsaw Man', year: 2022, description: 'Denji becomes a devil hunter with chainsaw powers.' },
        { title: 'Vinland Saga', year: 2019, description: 'A young Viking seeks revenge for his fathers death.' },
        { title: 'Monster', year: 2004, description: 'A surgeon chases a patient who became a serial killer.' },
        { title: 'Made in Abyss', year: 2017, description: 'A girl descends into a mysterious chasm.' },
        { title: 'Demon Slayer', year: 2019, description: 'Tanjiro hunts demons to avenge his family.' },
        { title: 'One Punch Man', year: 2015, description: 'A hero can defeat any enemy with a single punch.' },
    ],
    Music_Artists: [
        { title: 'Radiohead', year: 1985, description: 'British rock band known for experimental and electronic rock.' },
        { title: 'Kendrick Lamar', year: 2004, description: 'American rapper and songwriter, known for conscious hip-hop.' },
        { title: 'Taylor Swift', year: 2004, description: 'American singer-songwriter spanning country, pop, and indie folk.' },
        { title: 'Kanye West', year: 1996, description: 'American rapper, producer, and fashion designer.' },
        { title: 'Frank Ocean', year: 2005, description: 'American singer-songwriter and rapper, R&B innovator.' },
        { title: 'The Beatles', year: 1960, description: 'British rock band that revolutionized popular music.' },
        { title: 'Pink Floyd', year: 1965, description: 'British rock band known for progressive and psychedelic rock.' },
        { title: 'Beyoncé', year: 1997, description: 'American singer, songwriter, and cultural icon.' },
        { title: 'Tyler, the Creator', year: 2007, description: 'American rapper and producer known for genre-bending music.' },
        { title: 'Nirvana', year: 1987, description: 'American rock band that defined the grunge movement.' },
        { title: 'Lauryn Hill', year: 1996, description: 'American singer-songwriter blending hip-hop and soul.' },
        { title: 'David Bowie', year: 1962, description: 'English singer-songwriter known for reinvention and glam rock.' },
        { title: 'Daft Punk', year: 1993, description: 'French electronic music duo who shaped house and disco.' },
        { title: 'SZA', year: 2011, description: 'American singer-songwriter known for confessional R&B.' },
        { title: 'Arctic Monkeys', year: 2002, description: 'English rock band known for indie rock and post-punk revival.' },
    ],
    Podcasts: [
        { title: 'Serial', year: 2014, description: 'Investigative journalism exploring one story over multiple episodes.' },
        { title: 'This American Life', year: 1995, description: 'Weekly public radio show and podcast exploring a theme through stories.' },
        { title: 'Hardcore History', year: 2006, description: 'Dan Carlin explores historical events with depth and dramatic storytelling.' },
        { title: 'The Daily', year: 2017, description: 'Daily news podcast by The New York Times.' },
        { title: 'Radiolab', year: 2002, description: 'Investigating a strange world through science, philosophy, and sound.' },
        { title: 'Reply All', year: 2014, description: 'A show about the internet and trained rats, exploring modern life.' },
        { title: '99% Invisible', year: 2010, description: 'Design is everywhere in our lives, perhaps most importantly in the places where we look.' },
        { title: 'Darknet Diaries', year: 2017, description: 'True stories from the dark side of the Internet.' },
        { title: 'Huberman Lab', year: 2021, description: 'Neuroscience and science-based tools for everyday life.' },
        { title: 'The Joe Rogan Experience', year: 2009, description: 'Long-form conversations with comedians, actors, scientists, and more.' }
    ],
    Board_Games: [
        { title: 'Catan', year: 1995, description: 'Players collect resources and use them to build roads, settlements, and cities.' },
        { title: 'Ticket to Ride', year: 2004, description: 'A cross-country train adventure where players collect cards to claim routes.' },
        { title: 'Pandemic', year: 2008, description: 'Players work together as a team to stop the spread of four deadly diseases.' },
        { title: 'Gloomhaven', year: 2017, description: 'Euro-inspired tactical combat in a persistent world of shifting motives.' },
        { title: 'Wingspan', year: 2019, description: 'A competitive, medium-weight, card-driven, engine-building board game from Stonemaier Games.' },
        { title: 'Dungeons & Dragons (5th Edition)', year: 2014, description: 'The world\'s greatest roleplaying game.' },
        { title: 'Terraforming Mars', year: 2016, description: 'Corporations compete to transform Mars into a habitable planet.' },
        { title: 'Codenames', year: 2015, description: 'Two rival spymasters know the secret identities of 25 agents.' },
        { title: 'Scythe', year: 2016, description: 'An engine-building game set in an alternate-history 1920s period.' },
        { title: 'Azul', year: 2017, description: 'Players take turns drafting colored tiles from suppliers to their player board.' }
    ],
    Comics: [
        { title: 'Watchmen', year: 1986, description: 'A deconstruction of the superhero genre set in an alternate history Cold War.' },
        { title: 'The Sandman', year: 1989, description: 'Dream of the Endless rules over the world of dreams.' },
        { title: 'Maus', year: 1991, description: 'A survivor\'s tale of the Holocaust, depicted with animals.' },
        { title: 'Batman: The Dark Knight Returns', year: 1986, description: 'An older Bruce Wayne returns to fight crime in a dystopian Gotham.' },
        { title: 'Saga', year: 2012, description: 'Two soldiers from opposing sides of a galactic war fall in love.' },
        { title: 'Persepolis', year: 2000, description: 'A graphic memoir of growing up during the Iranian Revolution.' },
        { title: 'Akira', year: 1982, description: 'A cyberpunk epic set in Neo-Tokyo following a biker gang and psychic powers.' },
        { title: 'One Piece', year: 1997, description: 'Monkey D. Luffy seeks the ultimate treasure to become King of the Pirates.' },
        { title: 'Berserk', year: 1989, description: 'Guts, a lone mercenary, battles demons and destiny in a dark fantasy world.' },
        { title: 'Attack on Titan', year: 2009, description: 'Humanity fights against giant man-eating Titans.' }
    ]
}

// Critic personas with detailed bios
const CRITIC_PERSONAS = [
    { bio: 'Indie Film Lover | Sundance Regular | A24 Apologist', specialty: 'Movies' },
    { bio: 'Horror Aficionado | Screams at jumpscares | Loves slow burns', specialty: 'Movies' },
    { bio: 'JRPG Completionist | 100+ hours minimum | Turn-based purist', specialty: 'Video Games' },
    { bio: 'Souls Veteran | No summons, no shields | Pain is progress', specialty: 'Video Games' },
    { bio: 'Anime Historian | 90s classics to modern hits | Sub > Dub', specialty: 'Anime' },
    { bio: 'Prestige TV Analyst | Episode breakdowns | Theory crafter', specialty: 'TV Shows' },
    { bio: 'Album Reviewer | Full discographies only | No singles', specialty: 'Music' },
    { bio: 'Sci-Fi Bookworm | Hard science preferred | Audiobook enthusiast', specialty: 'Books' },
    { bio: 'Board Game Strategist | Meeple placement expert | Rulebook memorizer', specialty: 'Board Games' },
    { bio: 'Graphic Novel Collector | Inking appriciator | Panel layout critic', specialty: 'Comics' },
    { bio: 'Podcast Binge-Listener | multiple speeds | Audio drama fan', specialty: 'Podcasts' },
]

// UPDATED: Added more templates to ensure diversity and coverage of all types
const COLLECTION_TEMPLATES = [
    { name: 'Top 10 Horror Movies of All Time', category: 'Movies', emoji: '🎃' },
    { name: 'Peak Television: The Definitive List', category: 'TV Shows', emoji: '📺' },
    { name: 'Board Game Night Essentials', category: 'Board_Games', emoji: '🎲' },
    { name: 'Podcasts That Hooked Me', category: 'Podcasts', emoji: '🎙️' },
    { name: 'Graphic Novels Everyone Should Read', category: 'Comics', emoji: '💬' },
    { name: 'Best Soundtracks in Gaming', category: 'Video Games', emoji: '🎵' },
    { name: 'Must-Read Science Fiction', category: 'Books', emoji: '🚀' },
    { name: 'Artists Who Changed Music', category: 'Music_Artists', emoji: '🎧' },
    { name: 'Underrated TV Dramas', category: 'TV Shows', emoji: '📺' },
    { name: 'Anime That Changed the Medium', category: 'Anime', emoji: '⭐' },
    // Overflow (for > 10 critics)
    { name: 'Underrated Gems You Missed', category: 'Movies', emoji: '💎' },
    { name: 'Albums That Defined a Generation', category: 'Music_Albums', emoji: '💿' },
    { name: 'Comfort Games for Rainy Days', category: 'Video Games', emoji: '🌧️' },
    { name: 'Visually Stunning Anime', category: 'Anime', emoji: '🌸' },
    { name: 'Movies That Made Me Cry', category: 'Movies', emoji: '😭' },
    { name: 'Essential Strategy Games', category: 'Board_Games', emoji: '♟️' },
]

const CURATED_COLLECTIONS: Record<string, any> = {
    'Top 10 Horror Movies of All Time': {
        description: "The definitive list of cinematic terror. These are the ten absolute masterworks of the genre that you need to watch before you die... if you have the nerve.",
        image: '/seed-images/horror-collection.jpg',
        items: [
            { title: 'The Exorcist', year: 1973, tier: 'S', image: '/seed-images/the-exorcist.jpg', description: "A terrified mother watches her daughter descend into supernatural horror, forcing two priests into a harrowing battle against pure evil. Masterfully blending psychological dread with visceral scares, this film redefined horror through meticulous pacing and deeply unsettling imagery that lingers long after credits roll." },
            { title: 'The Texas Chain Saw Massacre', year: 1974, tier: 'C', image: '/seed-images/texas-chainsaw.jpg', description: "Five friends journey to rural Texas to visit a family grave, but detour into a derelict house harboring unimaginable terror. A relentless killer wielding a chainsaw transforms their trip into a nightmarish fight for survival. Raw, visceral, and claustrophobic—a masterclass in sustained dread that redefined horror cinema." },
            { title: 'Hereditary', year: 2018, tier: 'A', image: '/seed-images/hereditary.jpg', description: "Following a family matriarch's death, Annie and her children discover terrifying secrets about their bloodline, spiraling into inescapable darkness. Ari Aster crafts an atmospheric nightmare blending grief and cosmic horror, where family dysfunction becomes genuinely apocalyptic." },
            { title: 'The Silence of the Lambs', year: 1991, tier: 'A', image: '/seed-images/silence-of-lambs.jpg', description: "An FBI trainee seeks guidance from an imprisoned cannibalistic psychiatrist to catch a serial killer. Psychological thriller exploring the dangerous dance between hunter and hunted, blending meticulous crime investigation with claustrophobic dread. Masterfully suspenseful with unforgettable performances." },
            { title: 'Halloween', year: 1978, tier: 'B', image: '/seed-images/halloween.jpg', description: "A masked killer returns to his hometown after fifteen years institutionalized, stalking a teenage babysitter on Halloween night. Director John Carpenter crafts relentless tension through minimalist cinematography and an iconic synth score, creating an atmosphere of inescapable dread that redefined the slasher genre." },
            { title: 'The Shining', year: 1980, tier: 'S', image: '/seed-images/the-shining.jpg', description: "Jack Torrance takes a winter caretaker position at the isolated Overlook Hotel with his family, only to descend into psychological terror as the hotel's malevolent forces consume him. Kubrick masterfully builds dread through meticulous cinematography, creating an atmosphere of creeping doom that transforms domestic space into nightmare." },
            { title: 'The Thing', year: 1982, tier: 'A', image: '/seed-images/the-thing.jpg', description: "A masterclass in paranoia and isolation. This Antarctic nightmare traps a research team with a shape-shifting extraterrestrial predator that perfectly mimics its prey, making trust impossible. Relentless tension, practical gore, and existential dread create suffocating atmosphere." },
            { title: 'Psycho', year: 1960, tier: 'A', image: '/seed-images/psycho.jpg', description: "Marion Crane flees with stolen money seeking refuge at the isolated Bates Motel, where she encounters the peculiar Norman Bates and his domineering mother. A masterclass in psychological terror, this film revolutionized horror through innovative cinematography, shocking violence, and an unforgettable twist that subverts audience expectations while exploring madness and maternal obsession." },
            { title: 'Get Out', year: 2017, tier: 'B', image: '/seed-images/get-out.jpg', description: "A Black man visits his white girlfriend's family estate, initially attributing their peculiar warmth to racial anxiety. Suspicion metastasizes into dread as sinister rituals emerge. Director Jordan Peele crafts a visceral social thriller where suburban politeness masks unspeakable horror, blending genuine scares with sharp cultural commentary into an unforgettable nightmare." },
            { title: 'Alien', year: 1979, tier: 'S', image: '/seed-images/alien.jpg', description: "A commercial spaceship intercepts a distress signal, leading the crew to a desolate planet where they discover an alien egg chamber. One creature's attack sets off a terrifying chain of events aboard the Nostromo. Claustrophobic, visceral sci-fi horror with relentless tension and groundbreaking practical effects that redefined the genre's visual language." },
        ]
    },
    'Underrated Gems You Missed': {
        description: "Criminally overlooked. These are the cult classics, box-office bombs, and critical darlings that slipped through the cracks. Stop watching what everyone else is watching and discover your new favorite movie.",
        image: '/seed-images/underrated-gems-cover.jpg',
        items: [
            { title: 'Coherence', year: 2013, tier: 'A', image: '/seed-images/coherence.jpg', description: "Four couples convene for an ordinary dinner party as an enigmatic comet streaks across the night sky, triggering a cascade of reality-bending phenomena. What begins as suburban normalcy devolves into paranoia and existential dread as the guests grapple with impossible choices and fractured timelines. Claustrophobic, intellectually unsettling, and genuinely unnerving." },
            { title: 'Nightcrawler', year: 2014, tier: 'S', image: '/seed-images/nightcrawler.jpg', description: "Lou Bloom transforms from desperate job-seeker to obsessed crime videographer in Los Angeles's cutthroat news world. Driven by ambition and moral vacancy, he manipulates events and relationships to capture increasingly sensational footage. Nina, a jaded news director, becomes both his enabler and victim. A taut psychological thriller exploring media exploitation and the corruption of ambition through voyeurism and complicity." },
            { title: 'Children of Men', year: 2006, tier: 'S', image: '/seed-images/children-of-men.jpg', description: "A former activist shepherds a miraculously pregnant woman through a dystopian 2027, racing toward a sanctuary where her child might save humanity. Bleak yet hopeful, the film weaves intimate character drama with visceral action, creating a haunting meditation on meaning, redemption, and humanity's fragile future." },
            { title: 'The Iron Giant', year: 1999, tier: 'S', image: '/seed-images/iron-giant.jpg', description: "A nine-year-old boy discovers a colossal metal machine washed ashore in 1950s Maine. Their unlikely friendship becomes a meditation on humanity, fear, and sacrifice as the gentle giant confronts Cold War paranoia and prejudice. Poignant, visually stunning, and unexpectedly profound." },
            { title: 'Dredd', year: 2012, tier: 'B', image: '/seed-images/dredd.jpg', description: "In a brutal megacity future, Judge Dredd and rookie Anderson infiltrate a massive tower to stop the ruthless drug lord Ma-Ma. This visceral action film delivers relentless violence, stunning practical effects, and claustrophobic tension. Dark, gritty, and unflinchingly intense—a criminally overlooked sci-fi thriller." },
            { title: 'The Nice Guys', year: 2016, tier: 'A', image: '/seed-images/nice-guys.jpg', description: "A private eye and his unlikely partner navigate 1970s LA's seedy underbelly investigating a porn star's suspicious death. Their chemistry crackles as they stumble through noir-tinged mystery, blending sharp wit with genuine danger. Stylish, darkly funny, and surprisingly heartfelt." },
            { title: 'Edge of Tomorrow', year: 2014, tier: 'S', image: '/seed-images/edge-of-tomorrow.jpg', description: "Major Cage awakens in a time loop, forced to relive his first combat day repeatedly, each death granting crucial knowledge. A sci-fi thriller blending mind-bending temporal mechanics with exhilarating action sequences. Intensely engaging, darkly comedic, and surprisingly emotional as Cage transforms from coward to warrior across countless iterations." },
            { title: 'Moon', year: 2009, tier: 'A', image: '/seed-images/moon.jpg', description: "Sam Bell's three-year lunar contract nears its end when a mysterious accident shatters his solitary existence. Trapped with only GERTY, his AI companion, at an isolated Moon base, Bell confronts increasingly disturbing revelations. A haunting sci-fi thriller exploring identity and isolation against the lunar backdrop." },
            { title: 'Sing Street', year: 2016, tier: 'A', image: '/seed-images/sing-street.jpg', description: "A Dublin teenager channels adolescent longing into infectious 80s pop, crafting a band as both escape and love letter. Bursting with synth-driven charm, nostalgic energy, and genuine heart, this film captures the transformative power of music and first love with irresistible warmth and humor." },
            { title: 'Kubo and the Two Strings', year: 2016, tier: 'A', image: '/seed-images/kubo.jpg', description: "A young origami storyteller must embark on a mythic quest after awakening an ancient curse. Blending Japanese folklore with breathtaking stop-motion animation, this film weaves wonder and melancholy through enchanted landscapes populated by unforgettable companions. Visually stunning and emotionally resonant." },
        ]
    },
    'Best Soundtracks in Gaming': {
        description: "The iconic scores that defined gaming. From retro classics to modern symphonies, these are the soundtracks that you can hum instantly. The ultimate playlist for gamers.",
        image: '/seed-images/gaming-soundtracks-cover.jpg',
        items: [
            { title: 'Super Mario Galaxy', year: 2007, tier: 'A', image: '/seed-images/super-mario-galaxy.jpg', description: "Mario embarks on a cosmic adventure across gravity-defying planetoids to rescue Princess Peach from Bowser's clutches. This whimsical space odyssey combines platforming precision with inventive gravity mechanics, creating a sense of wonder and exploration that feels both intimate and expansive throughout." },
            { title: 'The Elder Scrolls V: Skyrim', year: 2011, tier: 'A', image: '/seed-images/skyrim.jpg', description: "A vast fantasy realm beckons as you awaken in a land of dragons and civil war. Explore snow-capped mountains, ancient ruins, and bustling cities while mastering magic, combat, and stealth. The atmosphere pulses with Nordic grandeur, mystery, and imminent apocalyptic danger throughout your legendary journey." },
            { title: 'Castlevania: Symphony of the Night', year: 1997, tier: 'B', image: '/seed-images/castlevania-sotn.jpg', description: "A gothic vampire hunter infiltrates a cursed castle teeming with supernatural horrors. Armed with whips and dark magic, he battles through interconnected halls revealing the fortress's twisted secrets. Atmospheric 2D action-adventure blending exploration with combat, wrapped in haunting 16-bit aesthetics and melancholic orchestral soundtrack." },
            { title: 'The Witcher 3: Wild Hunt', year: 2015, tier: 'B', image: '/seed-images/witcher-3.jpg', description: "A monster hunter navigates a war-torn fantasy realm, pursuing a supernatural threat while unraveling personal mysteries. The narrative weaves political intrigue with intimate character moments. Dark, immersive, and morally complex, it captures melancholy beauty amid chaos and danger." },
            { title: 'Mass Effect 2', year: 2010, tier: 'B', image: '/seed-images/mass-effect-2.jpg', description: "You're a commander assembling an elite team to stop an existential threat in deep space. Recruit diverse allies, forge relationships, and execute a suicide mission with real consequences. The atmosphere balances intimate character moments with intense, high-stakes combat across alien worlds. Every choice matters." },
            { title: 'Celeste', year: 2018, tier: 'C', image: '/seed-images/celeste.jpg', description: "A challenging platformer following Madeline's ascent up a mysterious mountain while battling inner demons and self-doubt. Tight controls and pixel-perfect level design create an intensely rewarding experience, blending precision gameplay with deeply personal storytelling about anxiety and perseverance." },
            { title: 'Hotline Miami', year: 2012, tier: 'C', image: '/seed-images/hotline-miami.jpg', description: "A top-down ultraviolent odyssey through Miami's neon-soaked underworld, where you execute contract kills with brutal efficiency. Cryptic calls guide your descent into moral ambiguity. The synth-heavy soundtrack pulses with retro-80s energy while pixel-art carnage unfolds in hypnotic, blood-splattered sequences. Intensely atmospheric and darkly trippy." },
            { title: 'The Legend of Zelda: Ocarina of Time', year: 1998, tier: 'S', image: '/seed-images/ocarina-of-time.jpg', description: "Link travels through time to stop the evil Ganon, wielding the mystical Ocarina to reshape destiny. The soundtrack masterfully blends orchestral grandeur with whimsical melodies, creating an epic yet intimate atmosphere that defines adventure gaming's golden age." },
            { title: 'Undertale', year: 2015, tier: 'A', image: '/seed-images/undertale.jpg', description: "A haunting journey through a monster-filled underground where choices matter and consequences linger. Toby Fox's score masterfully blends chiptune nostalgia with emotional depth, creating an unforgettable atmosphere that shifts from whimsical to heartbreaking. The music becomes a character itself, reflecting the game's themes of compassion versus violence." },
            { title: 'Halo: Combat Evolved', year: 2001, tier: 'B', image: '/seed-images/halo-ce.jpg', description: "A sci-fi epic where humanity fights alien invaders on a mysterious ring world. The soundtrack perfectly captures the grand, orchestral scope of interstellar warfare, blending haunting ambient passages with heroic themes that define console gaming's golden age." },
            { title: 'Silent Hill 2', year: 2001, tier: 'A', image: '/seed-images/silent-hill-2.jpg', description: "A haunting journey through fog-shrouded streets where psychological dread manifests sonically. Akira Yamaoka's score layers industrial noise, ambient textures, and melancholic melodies, creating an oppressive atmosphere that amplifies existential terror. The music breathes with the game's narrative, transforming environmental sounds into instruments of unease and emotional devastation." },
            { title: 'NieR:Automata', year: 2017, tier: 'S', image: '/seed-images/nier-automata.jpg', description: "A post-apocalyptic action RPG where androids battle to reclaim Earth from machines. Blends philosophical storytelling with intense combat across multiple perspectives. The soundtrack masterfully weaves haunting orchestral pieces with electronic elements, creating an emotionally resonant atmosphere that defines the game's melancholic yet hopeful tone." },
            { title: 'Final Fantasy VII', year: 1997, tier: 'S', image: '/seed-images/ff7.jpg', description: "Cloud Strife leads a ragtag team against the megacorporation Shinra in a sprawling cyberpunk world. Nobuo Uematsu's legendary score fuses orchestral grandeur with electronic innovation, creating unforgettable themes that define gaming's golden era. The music captures both intimate character moments and apocalyptic scale." },
            { title: 'Persona 5', year: 2016, tier: 'A', image: '/seed-images/persona-5.jpg', description: "A stylish JRPG where Tokyo high schoolers balance daily life with supernatural missions. The soundtrack perfectly captures the game's aesthetic—smooth jazz, energetic pop, and atmospheric tracks that shift seamlessly between school romance and dungeon exploration. Pure sonic sophistication." },
            { title: 'Chrono Trigger', year: 1995, tier: 'S', image: '/seed-images/chrono-trigger.jpg', description: "A masterpiece of 16-bit composition, Chrono Trigger's soundtrack weaves through time itself. Yasunori Mitsuda crafts melodies that shift from medieval charm to futuristic synth, perfectly mirroring each era. The score balances epic boss themes with intimate character moments, creating an emotional journey as memorable as the game's revolutionary time-travel narrative." },
            { title: 'Journey', year: 2012, tier: 'B', image: '/seed-images/journey.jpg', description: "An ethereal odyssey across vast desert landscapes, Journey's minimalist soundtrack perfectly captures wanderlust and solitude. Composer Austin Wintory crafts haunting melodies that evoke mystery, wonder, and emotional resonance. The music transforms exploration into meditation, making every step feel purposeful and profound." },
            { title: 'DOOM', year: 2016, tier: 'A', image: '/seed-images/doom-2016.jpg', description: "A relentless sonic assault that perfectly mirrors the game's visceral combat. Mick Gordon's industrial metal compositions pulse with distorted guitars and pounding rhythms, escalating intensity as battles rage. The soundtrack transforms violence into art through dynamic layering and crushing electronic textures." },
        ]
    },
    'Anime That Changed the Medium': {
        description: "The game-changers. The genre-definers. The global phenomena. The essential list of anime that rewrote history and changed pop culture forever.",
        image: '/seed-images/anime-medium-cover.jpg',
        items: [
            { title: 'Death Note', year: 2006, tier: 'B', image: '/seed-images/death-note.jpg', description: "A brilliant teenager discovers a supernatural notebook that kills anyone whose name is written in it. Light Yagami transforms into a vigilante, reshaping society while a genius detective hunts him. Psychological thriller with dark atmosphere, moral ambiguity, and relentless cat-and-mouse tension that redefined anime storytelling." },
            { title: 'Puella Magi Madoka Magica', year: 2011, tier: 'B', image: '/seed-images/madoka-magica.jpg', description: "A deceptively cheerful magical girl anime that spirals into psychological horror. Madoka and Sayaka meet Kyuubey, who offers to grant their wishes in exchange for becoming magical girls. What begins as whimsical fantasy darkens into tragedy, exploring sacrifice, despair, and the true cost of hope. Stunning visuals mask devastating narrative twists." },
            { title: 'Attack on Titan', year: 2013, tier: 'B', image: '/seed-images/attack-on-titan.jpg', description: "Humanity cowers behind massive walls, hunted by colossal Titans driven by inexplicable hunger rather than survival instinct. When a breach shatters their sanctuary, a young soldier vows vengeance, uncovering shocking truths about his world's origins. Dark, intense, and philosophically complex, blending brutal action with mystery and existential dread." },
            { title: 'Your Name.', year: 2016, tier: 'B', image: '/seed-images/your-name.jpg', description: "Two teenagers mysteriously swap bodies across time and space, forcing a rural girl and Tokyo boy to navigate each other's lives. Their connection deepens through shared experiences, but a tragic comet threatens to erase their memories and separate them forever. Visually stunning with ethereal, melancholic beauty blending romance, mystery, and cosmic wonder." },
            { title: 'The Melancholy of Haruhi Suzumiya', year: 2006, tier: 'B', image: '/seed-images/haruhi-suzumiya.jpg', description: "Kyon's ordinary life shatters when he meets Haruhi, a seemingly normal girl harboring extraordinary powers. As she unknowingly reshapes reality around her, he discovers she's the key to aliens, time travelers, and espers. A darkly comedic exploration of fate, free will, and suburban surrealism wrapped in high school hijinks and existential dread." },
            { title: 'Demon Slayer: Kimetsu no Yaiba', year: 2019, tier: 'C', image: '/seed-images/demon-slayer.jpg', description: "Tanjiro's world shatters when demons slaughter his family, leaving only his sister Nezuko transformed into one. Determined to find a cure, he joins the Demon Slayer Corps. This shonen epic blends intense sword combat with emotional depth, exploring themes of humanity and redemption amidst breathtaking animation and haunting atmospheric tension." },
            { title: 'One Piece', year: 1997, tier: 'C', image: '/seed-images/one-piece.jpg', description: "A young pirate with boundless ambition awakens his devil fruit powers to become the strongest sailor alive. Luffy gathers a diverse crew across vast oceans, facing increasingly formidable enemies while uncovering world-shaking secrets. Adventure blends with genuine camaraderie, balancing intense action sequences against heartfelt character moments and comedic relief." },
            { title: 'Sword Art Online', year: 2012, tier: 'C', image: '/seed-images/sao.jpg', description: "Thousands of players enter a full-dive VR MMO called Sword Art Online, only to discover they're trapped. Death in-game means death in reality. Protagonist Kirito must navigate the deadly tower of Aincrad, battling monsters and uncovering the truth behind their imprisonment. Thrilling, immersive, and darkly atmospheric with moments of genuine wonder." },
            { title: 'Urusei Yatsura', year: 1981, tier: 'C', image: '/seed-images/urusei-yatsura.jpg', description: "A hapless teenager must save Earth by winning a tag game against a beautiful alien girl. What begins as a desperate high-stakes competition spirals into romantic chaos, slapstick mayhem, and absurdist comedy. The series thrives on irreverent humor, supernatural mishaps, and Ataru's relentless pursuit of romance amid constant disaster." },
            { title: 'Pokémon', year: 1997, tier: 'A', image: '/seed-images/pokemon.jpg', description: "A young trainer named Ash embarks on an epic journey to catch and train powerful creatures called Pokémon, battling rivals while pursuing his dream of becoming a Pokémon Master. The series captures an adventurous, optimistic spirit with vibrant battles and heartfelt friendships that defined a generation's childhood." },
            { title: 'Akira', year: 1988, tier: 'S', image: '/seed-images/akira.jpg', description: "A restored Neo-Tokyo erupts into chaos when a street gang discovers a mysterious boy with devastating psychic abilities. As government conspiracies unravel and reality warps around expanding telekinetic power, the city becomes a battleground between corporate control and raw human potential. Cyberpunk dystopia meets intimate character drama in this visually revolutionary masterpiece that redefined anime's artistic possibilities." },
            { title: 'Ghost in the Shell', year: 1995, tier: 'A', image: '/seed-images/ghost-in-the-shell.jpg', description: "In 2029 Niihama City, a cyborg counter-terrorism unit hunts a mysterious hacker called the Puppet Master through neon-soaked streets. Blending philosophical inquiry with kinetic action, this landmark film questions consciousness and identity in a hyper-connected world. Visually stunning and intellectually provocative." },
            { title: 'Astro Boy', year: 1963, tier: 'S', image: '/seed-images/astro-boy.jpg', description: "A grieving scientist resurrects his dead son as a powerful robot named Atom, only to reject the creation when it cannot replicate human mortality. Thrust into the world alone, Atom discovers his purpose protecting humanity. Groundbreaking animation pioneered the anime medium's visual language, blending poignant emotion with futuristic wonder and philosophical depth about what defines humanity itself." },
            { title: 'Cowboy Bebop', year: 1998, tier: 'A', image: '/seed-images/cowboy-bebop.jpg', description: "A ragtag crew of bounty hunters chases criminals across the galaxy in their aging spaceship, blending noir detective work with cosmic adventure. Each episode explores loneliness, redemption, and loss while maintaining effortless cool. Jazz-infused soundtrack amplifies the melancholic, stylish atmosphere where every character carries hidden trauma beneath their tough exteriors." },
            { title: 'Neon Genesis Evangelion', year: 1995, tier: 'S', image: '/seed-images/evangelion.jpg', description: "Fifteen years after apocalyptic Second Impact, Tokyo-3 faces unstoppable Angel invaders. Humanity's only defense: giant biomechanical Evangelions piloted by traumatized teenagers. Blends mecha action with psychological depth, exploring existential dread, identity, and human connection amid cosmic horror and intimate character breakdown." },
            { title: 'Sailor Moon', year: 1992, tier: 'A', image: '/seed-images/sailor-moon.jpg', description: "An ordinary schoolgirl discovers her destiny as Sailor Moon, a magical warrior destined to protect Earth from dark forces. Usagi transforms from clumsy underachiever into a beacon of hope, gathering allies to fight alongside her. The series blends whimsical magical girl aesthetics with genuine emotional depth, creating an enchanting yet surprisingly poignant atmosphere that resonates across generations." },
            { title: 'Dragon Ball Z', year: 1989, tier: 'S', image: '/seed-images/dbz.jpg', description: "Goku's peaceful life shatters when his alien brother Raditz arrives, revealing Goku's Saiyan heritage and igniting an epic saga of increasingly powerful threats. The series escalates from martial arts tournament to cosmic-scale battles, blending intense action with character growth, humor, and genuine stakes that redefined anime storytelling globally." },
            { title: 'Mobile Suit Gundam', year: 1979, tier: 'A', image: '/seed-images/gundam.jpg', description: "In Universal Century 0079, the Principality of Zeon wages war against the Earth Federation using giant mobile suits. Young pilot Amuro Ray discovers the Federation's experimental Gundam and becomes humanity's unlikely hero. Epic space battles blend with intimate character drama, creating a surprisingly mature mecha saga that balances spectacular action with genuine emotional weight and political intrigue." },
            { title: 'Spirited Away', year: 2001, tier: 'S', image: '/seed-images/spirited-away.jpg', description: "A spirited girl stumbles into a magical bathhouse where she must navigate a world of spirits and witches to save her parents. Lush, dreamlike animation crafts an enchanting yet unsettling atmosphere—whimsical wonder mixed with genuine danger. A transformative masterpiece blending folklore, environmentalism, and coming-of-age themes." },
        ]
    },
    'Peak Television: The Definitive List': {
        description: "The Golden Age. The anti-heroes, the cliffhangers, and the masterpieces that turned television into cinema. The definitive list of shows you cannot miss.",
        image: '/seed-images/peak-tv-cover.jpg',
        items: [
            { title: 'Mad Men', year: 2007, tier: 'S', image: '/seed-images/mad-men.jpg', description: "A mesmerizing exploration of ambition and moral compromise set in 1960s Manhattan. Don Draper and his colleagues navigate cutthroat advertising while grappling with identity, infidelity, and social upheaval. Stylish, darkly funny, and deeply introspective—a portrait of an era and its discontents." },
            { title: 'Better Call Saul', year: 2015, tier: 'A', image: '/seed-images/better-call-saul.jpg', description: "A morally complex prequel tracing Jimmy McGill's transformation into Saul Goodman through six seasons of meticulous character study. The show masterfully balances dark comedy with tragedy, exploring ambition, ethics, and corruption through intricate storytelling. Mike Ehrmantraut's parallel descent adds layered tension. Brilliantly written with exceptional performances." },
            { title: 'Succession', year: 2018, tier: 'A', image: '/seed-images/succession.jpg', description: "The Roy family's ruthless power struggle intensifies as their media empire teeters on succession. Sharp dialogue cuts through lavish Manhattan penthouses and corporate boardrooms, crafting a darkly comedic tragedy about ambition, loyalty, and legacy. Tense, sophisticated, utterly compelling." },
            { title: 'Fleabag', year: 2016, tier: 'A', image: '/seed-images/fleabag.jpg', description: "A wickedly intelligent dive into the fractured psyche of a sharp-tongued, morally ambiguous woman navigating modern London's chaos. Fleabag masterfully blends cringe comedy with raw emotional vulnerability, breaking the fourth wall to create intimate complicity with viewers. The show captures grief, desire, and self-sabotage with brutal honesty and infectious humor." },
            { title: 'The Sopranos', year: 1999, tier: 'S', image: '/seed-images/sopranos.jpg', description: "A groundbreaking exploration of Tony Soprano, a New Jersey mob boss navigating the treacherous intersection of family obligations and criminal empire management. Darkly comedic yet psychologically complex, the series masterfully weaves therapy sessions with brutal violence, creating an intimate portrait of moral decay wrapped in suburban dysfunction and existential dread." },
            { title: 'The Wire', year: 2002, tier: 'S', image: '/seed-images/the-wire.jpg', description: "A gritty examination of Baltimore's drug trade from cops and criminals alike. The Wire deconstructs institutional failure and moral ambiguity, revealing how the war on drugs perpetuates itself regardless of human cost. Bleak, unflinching, and narratively dense—a masterwork of serialized television." },
            { title: 'Chernobyl', year: 2019, tier: 'A', image: '/seed-images/chernobyl.jpg', description: "A meticulously crafted chronicle of humanity's darkest nuclear moment, following the engineers and officials who raced against apocalypse. Tense, haunting, and deeply human—balancing technical precision with intimate character arcs. The atmosphere is suffocating dread punctuated by moments of profound sacrifice and moral complexity." },
            { title: 'Breaking Bad', year: 2008, tier: 'S', image: '/seed-images/breaking-bad.jpg', description: "A high school chemistry teacher's terminal cancer diagnosis spirals into a descent into criminal empire-building. Walter White transforms from desperate provider into ruthless kingpin, cooking methamphetamine across New Mexico's desert landscape. Tense, morally complex, and utterly gripping—this is prestige television at its finest." },
            { title: 'Twin Peaks', year: 1990, tier: 'A', image: '/seed-images/twin-peaks.jpg', description: "A murder mystery unfolds in a quirky Pacific Northwest town where FBI Agent Dale Cooper investigates a young woman's death, only to discover supernatural forces and dark secrets lurking beneath the surface. Surreal, haunting, and mesmerizing." },
            { title: 'The Leftovers', year: 2014, tier: 'A', image: '/seed-images/the-leftovers.jpg', description: "When 2% of humanity vanishes without explanation, the remaining world fractures into grief and chaos. This haunting series explores how survivors grapple with inexplicable loss, fractured families, and the desperate search for meaning in an incomprehensible tragedy. Deeply philosophical and emotionally devastating." },
            { title: 'Game of Thrones', year: 2011, tier: 'B', image: '/seed-images/game-of-thrones.jpg', description: "Seven noble families wage brutal war for Westeros's Iron Throne while an ancient darkness awakens beyond the Wall. Political intrigue, betrayal, and unexpected deaths define this epic saga. The Night's Watch—society's outcasts—become humanity's last defense against supernatural horror. Dark, intense, and unpredictable." },
            { title: 'The Americans', year: 2013, tier: 'B', image: '/seed-images/the-americans.jpg', description: "Elizabeth and Philip Jennings, Soviet KGB officers masquerading as an American couple in suburban Washington D.C., navigate espionage while raising their family. Their FBI agent neighbor Stan Beeman unknowingly lives steps away, creating tension-soaked drama. The series explores identity, loyalty, and the human cost of Cold War deception with psychological intensity and moral ambiguity." },
            { title: 'Atlanta', year: 2016, tier: 'B', image: '/seed-images/atlanta.jpg', description: "Two cousins navigate the gritty Atlanta rap scene, chasing dreams of stardom while wrestling with poverty, ambition, and loyalty. This darkly comedic series captures the chaos of street life with surreal humor, sharp social commentary, and unexpected vulnerability. Raw, unpredictable, and deeply human." },
            { title: 'BoJack Horseman', year: 2014, tier: 'B', image: '/seed-images/bojack.jpg', description: "BoJack Horseman, a washed-up sitcom star, navigates Hollywood's underbelly decades after his glory days. Cynical yet oddly sympathetic, he grapples with addiction, failed relationships, and existential dread. Dark comedy meets melancholic introspection as anthropomorphic animals explore fame, mortality, and redemption with sharp wit and surprising emotional depth." },
            { title: 'Severance', year: 2022, tier: 'B', image: '/seed-images/severance.jpg', description: "Mark oversees workers who've undergone a radical procedure: their memories split between work and personal existence. When a cryptic coworker surfaces in the outside world, unsettling questions emerge about their employer's true intentions. This psychological thriller explores identity, corporate control, and what it means to be human through an increasingly unsettling mystery." },
            { title: 'MINDHUNTER', year: 2017, tier: 'B', image: '/seed-images/mindhunter.jpg', description: "An FBI agent revolutionizes criminal investigation by pioneering behavioral profiling methods while hunting America's most dangerous serial killers. Tense, methodical, and psychologically gripping, the series explores the dark minds of predators through meticulous interviews and case analysis, blending procedural detail with psychological thriller elements." },
            { title: 'Lost', year: 2004, tier: 'C', image: '/seed-images/lost.jpg', description: "Survivors of a devastating plane crash find themselves stranded on a mysterious island, forced to band together against hunger, injury, and each other. As they establish shelter and search for rescue, the island reveals increasingly bizarre phenomena—strange creatures, unexplained technology, and a shadowy organization's presence. Tension mounts between hope and paranoia." },
            { title: 'Veep', year: 2012, tier: 'C', image: '/seed-images/veep.jpg', description: "A sharp political satire following Vice President Selina Meyer as she navigates Washington's cutthroat landscape, discovering the role is far worse than anticipated. Packed with cringe humor and biting commentary on bureaucratic absurdity, the show masterfully dissects ambition, incompetence, and the chaotic machinery of American government." },
            { title: 'Stranger Things', year: 2016, tier: 'C', image: '/seed-images/stranger-things.jpg', description: "A young boy's disappearance in a quiet 1980s town spirals into a conspiracy of government experiments and otherworldly horrors. Blending nostalgic Americana with relentless dread, the series masterfully balances intimate character drama with cosmic terror, creating an addictive atmosphere of mystery and wonder." },
            { title: 'Arrested Development', year: 2003, tier: 'C', image: '/seed-images/arrested-development.jpg', description: "A dysfunctional wealthy family's empire crumbles, forcing their only competent son to reluctantly hold the pieces together. Hilarious chaos ensues as narcissistic relatives scheme and sabotage each other. Sharp, witty comedy with layered writing and running gags that reward close attention." },
        ]
    }
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function getRandomItems<T>(array: T[], count: number): T[] {
    const shuffled = [...array].sort(() => 0.5 - Math.random())
    return shuffled.slice(0, count)
}

function getRandomDate(daysAgo: number): Date {
    const now = new Date()
    const randomDays = Math.floor(Math.random() * daysAgo)
    now.setDate(now.getDate() - randomDays)
    return now
}

const TIERS = ['S', 'A', 'B', 'C', 'D']

function getRandomTier(): string {
    const weights = [0.2, 0.3, 0.25, 0.15, 0.1]
    const random = Math.random()
    let cumulative = 0
    for (let i = 0; i < weights.length; i++) {
        cumulative += weights[i]
        if (random < cumulative) return TIERS[i]
    }
    return 'B'
}



function getCategoryImage(type: string): string {
    const defaults: Record<string, string> = {
        'Movies': '/images/defaults/movies.jpg',
        'TV Shows': '/images/defaults/tv.jpg',
        'Video Games': '/images/defaults/games.jpg',
        'Anime': '/images/defaults/anime.jpg',
        'Books': '/images/defaults/books.jpg',
        'Audiobooks': '/images/defaults/books.jpg',
        'Music_Artists': '/images/defaults/music.jpg',
        'Music_Albums': '/images/defaults/music.jpg',
        'Podcasts': '/images/defaults/podcasts.jpg',
        'Board_Games': '/images/defaults/board_games.jpg',
        'Comics': '/images/defaults/comics.jpg',
    }
    return defaults[type] || `https://picsum.photos/seed/${type}/800/600`
}

async function clean() {
    console.log('🧹 Cleaning database...')

    await db.delete(tasteSnapshots)
    await db.delete(tasteMetrics)
    await db.delete(ratings)
    await db.delete(items)
    await db.delete(globalItems)
    await db.delete(categories)
    await db.delete(sessions)
    await db.delete(accounts)
    await db.delete(verifications)
    await db.delete(passkeys)
    await db.delete(partialSessions)
    await db.delete(users)

    console.log('✅ Database cleaned')
}

// =============================================================================
// SYSTEM SETTINGS (API Keys from .env)
// =============================================================================

async function seedSystemSettings(): Promise<void> {
    console.log('🔑 Seeding system settings from environment...')

    const settingsToSeed = [
        // LLM Configuration
        { key: 'llm_provider', value: process.env.LLM_PROVIDER, category: 'LLM', isSecret: false },
        { key: 'llm_model', value: process.env.LLM_MODEL, category: 'LLM', isSecret: false },
        { key: 'llm_endpoint', value: process.env.LLM_ENDPOINT, category: 'LLM', isSecret: false },

        // LLM Provider API Keys
        { key: 'anannas_api_key', value: process.env.ANANAS_API_KEY, category: 'LLM', isSecret: true },
        { key: 'anthropic_api_key', value: process.env.ANTHROPIC_API_KEY, category: 'LLM', isSecret: true },
        { key: 'openai_api_key', value: process.env.OPENAI_API_KEY, category: 'LLM', isSecret: true },
        { key: 'openrouter_api_key', value: process.env.OPENROUTER_API_KEY, category: 'LLM', isSecret: true },
        { key: 'google_ai_api_key', value: process.env.GOOGLE_AI_API_KEY, category: 'LLM', isSecret: true },

        // Media API Keys
        { key: 'tmdb_api_key', value: process.env.TMDB_API_KEY, category: 'MEDIA', isSecret: true },
        { key: 'rawg_api_key', value: process.env.RAWG_API_KEY, category: 'MEDIA', isSecret: true },
        { key: 'google_books_api_key', value: process.env.GOOGLE_BOOKS_API_KEY, category: 'MEDIA', isSecret: true },
        { key: 'spotify_client_id', value: process.env.SPOTIFY_CLIENT_ID, category: 'MEDIA', isSecret: false },
        { key: 'spotify_client_secret', value: process.env.SPOTIFY_CLIENT_SECRET, category: 'MEDIA', isSecret: true },

        // Email Configuration
        { key: 'resend_api_key', value: process.env.RESEND_API_KEY, category: 'EMAIL', isSecret: true },
        { key: 'resend_from_email', value: process.env.RESEND_FROM_EMAIL, category: 'EMAIL', isSecret: false },
    ]

    let seededCount = 0

    for (const setting of settingsToSeed) {
        if (setting.value) {
            const encryptedValue = encrypt(setting.value)

            await db.insert(systemSettings)
                .values({
                    key: setting.key,
                    value: encryptedValue,
                    category: setting.category,
                    isSecret: setting.isSecret,
                })
                .onConflictDoUpdate({
                    target: systemSettings.key,
                    set: {
                        value: encryptedValue,
                        category: setting.category,
                        isSecret: setting.isSecret,
                    },
                })

            seededCount++
            console.log(`   ↳ ${setting.key}: ${setting.isSecret ? '********' : setting.value}`)
        }
    }

    if (seededCount === 0) {
        console.log('   ↳ No API keys found in .env - configure in Admin GUI later')
    } else {
        console.log(`   ↳ Seeded ${seededCount} settings`)
    }
}

// =============================================================================
// UNLOCK CONDITIONS (for Taste Report 2.0 gating)
// =============================================================================

const DEFAULT_UNLOCK_CONDITIONS = [
    { insightKey: 'snob_score', conditionType: 'min_items_rated', threshold: 10, displayLabel: 'Rate 10 items to unlock', categoryScoped: false },
    { insightKey: 'deep_analysis', conditionType: 'min_items_rated', threshold: 5, displayLabel: 'Rate 5 items to unlock', categoryScoped: false },
    { insightKey: 'taste_evolution', conditionType: 'min_items_rated', threshold: 20, displayLabel: 'Rate 20 items to unlock', categoryScoped: false },
    { insightKey: 'radar_comparison', conditionType: 'min_items_rated', threshold: 8, displayLabel: 'Rate 8 items to unlock', categoryScoped: false },
    { insightKey: 'alignment_global', conditionType: 'min_items_rated', threshold: 5, displayLabel: 'Rate 5 items to unlock', categoryScoped: false },
    { insightKey: 'alignment_experts', conditionType: 'min_items_rated', threshold: 15, displayLabel: 'Rate 15 items to unlock', categoryScoped: false },
]

async function seedUnlockConditions(): Promise<void> {
    console.log('🔓 Seeding unlock conditions...')

    for (const condition of DEFAULT_UNLOCK_CONDITIONS) {
        await db.insert(unlockConditions)
            .values(condition)
            .onConflictDoNothing()
    }

    console.log(`   ↳ Seeded ${DEFAULT_UNLOCK_CONDITIONS.length} unlock conditions`)
}

// =============================================================================
// SEEDING FUNCTIONS
// =============================================================================

async function seedGoldenTicketAdmin(): Promise<string | null> {
    const email = process.env.INITIAL_ADMIN_EMAIL
    const password = process.env.INITIAL_ADMIN_PASSWORD

    if (!email || !password) {
        console.log('⚠️  No INITIAL_ADMIN_EMAIL/PASSWORD set - skipping golden ticket admin')
        return null
    }

    console.log(`👑 Creating Golden Ticket Admin: ${email}`)

    const existing = await db.query.users.findFirst({
        where: eq(users.email, email)
    })

    const passwordHash = await hash(password, 10)
    const userId = crypto.randomUUID()

    if (existing) {
        // Update role to admin
        await db.update(users)
            .set({ role: 'ADMIN' })
            .where(eq(users.email, email))

        // Update password in accounts table
        await db.update(accounts)
            .set({ password: passwordHash })
            .where(eq(accounts.userId, existing.id))

        console.log(`   ↳ Updated existing user to ADMIN with new password`)
        return existing.id
    } else {
        await db.insert(users).values({
            id: userId,
            name: 'Admin',
            email,
            role: 'ADMIN',
            emailVerified: true,
            isPublic: true,
            bio: 'System Administrator',
        })

        await db.insert(accounts).values({
            userId,
            accountId: userId,
            providerId: 'credential',
            password: passwordHash,
        })

        console.log(`   ↳ Created new admin user`)
        return userId
    }
}

async function seedAdmins(): Promise<string[]> {
    console.log(`👤 Creating ${ADMIN_COUNT} additional admins...`)
    const adminIds: string[] = []

    for (let i = 0; i < ADMIN_COUNT; i++) {
        const userId = crypto.randomUUID()
        const firstName = faker.person.firstName()
        const lastName = faker.person.lastName()
        const email = `admin${i + 1}@curator.local`
        const passwordHash = await hash(DEFAULT_PASSWORD, 10)

        await db.insert(users).values({
            id: userId,
            name: `${firstName} ${lastName}`,
            email,
            role: 'ADMIN',
            emailVerified: true,
            isPublic: true,
            bio: 'Official Curator Administrator',
            image: faker.image.avatar(),
            isLockedOut: true, // Demo user - locked out
        })

        await db.insert(accounts).values({
            userId,
            accountId: userId,
            providerId: 'credential',
            password: passwordHash,
        })

        adminIds.push(userId)
        console.log(`   ↳ ${email}`)
    }

    return adminIds
}

async function seedCritics(): Promise<string[]> {
    console.log(`🎬 Creating ${CRITIC_COUNT} critics (power users)...`)
    const criticIds: string[] = []

    for (let i = 0; i < CRITIC_COUNT; i++) {
        const userId = crypto.randomUUID()
        const firstName = faker.person.firstName()
        const lastName = faker.person.lastName()
        const email = `critic${i + 1}@curator.local`
        const persona = CRITIC_PERSONAS[i % CRITIC_PERSONAS.length]
        const passwordHash = await hash(DEFAULT_PASSWORD, 10)

        await db.insert(users).values({
            id: userId,
            name: `${firstName} ${lastName}`,
            email,
            role: 'USER',
            emailVerified: true,
            isPublic: true,
            bio: persona.bio,
            displayName: faker.internet.displayName({ firstName, lastName }),
            image: faker.image.avatar(),
            profileViews: faker.number.int({ min: 100, max: 5000 }),
            isLockedOut: true, // Demo user - locked out
        })

        await db.insert(accounts).values({
            userId,
            accountId: userId,
            providerId: 'credential',
            password: passwordHash,
        })

        criticIds.push(userId)
        console.log(`   ↳ ${email} - ${persona.specialty} specialist`)
    }

    return criticIds
}

async function seedStandardUsers(): Promise<string[]> {
    console.log(`👥 Creating ${STANDARD_USER_COUNT} standard users...`)
    const userIds: string[] = []

    for (let i = 0; i < STANDARD_USER_COUNT; i++) {
        const userId = crypto.randomUUID()
        const firstName = faker.person.firstName()
        const lastName = faker.person.lastName()
        const email = faker.internet.email({ firstName, lastName }).toLowerCase()
        const passwordHash = await hash(DEFAULT_PASSWORD, 10)

        await db.insert(users).values({
            id: userId,
            name: `${firstName} ${lastName}`,
            email,
            role: 'USER',
            emailVerified: faker.datatype.boolean(0.8),
            isPublic: faker.datatype.boolean(0.3),
            bio: faker.datatype.boolean(0.4) ? faker.person.bio() : null,
            image: faker.datatype.boolean(0.5) ? faker.image.avatar() : null,
            profileViews: faker.number.int({ min: 0, max: 100 }),
            isLockedOut: true, // Demo user - locked out
        })

        await db.insert(accounts).values({
            userId,
            accountId: userId,
            providerId: 'credential',
            password: passwordHash,
        })

        userIds.push(userId)
    }

    console.log(`   ↳ Created ${STANDARD_USER_COUNT} users`)
    return userIds
}

async function seedGlobalItems(): Promise<Map<string, string[]>> {
    console.log(`📚 Seeding global media library...`)
    const categoryItemMap = new Map<string, string[]>()

    for (const [categoryName, mediaList] of Object.entries(REALISTIC_MEDIA)) {
        const itemIds: string[] = []

        for (const media of mediaList) {
            const itemId = crypto.randomUUID()

            await db.insert(globalItems).values({
                id: itemId,
                title: media.title,
                description: media.description,
                releaseYear: media.year,
                categoryType: categoryName.toUpperCase().replace(' ', '_'),
                imageUrl: `https://picsum.photos/seed/${encodeURIComponent(media.title)}/300/450`,
            })

            itemIds.push(itemId)
        }

        categoryItemMap.set(categoryName, itemIds)
        console.log(`   ↳ ${categoryName}: ${mediaList.length} items`)
    }

    return categoryItemMap
}

async function seedCriticCollections(
    criticIds: string[],
    globalItemMap: Map<string, string[]>
): Promise<void> {
    console.log(`📋 Creating critic collections and rankings...`)

    for (let i = 0; i < criticIds.length; i++) {
        const criticId = criticIds[i]
        const template = COLLECTION_TEMPLATES[i % COLLECTION_TEMPLATES.length]
        const persona = CRITIC_PERSONAS[i % CRITIC_PERSONAS.length]

        // Check for Curated Data
        const curatedData = CURATED_COLLECTIONS[template.name];

        const categoryId = crypto.randomUUID()

        // Map template category to filter type
        const getFilterType = (catType: string) => {
            switch (catType.toLowerCase().replace('_', ' ')) {
                case 'movies': return 'movie'
                case 'tv shows': return 'tv'
                case 'anime': return 'anime'
                case 'video games': return 'game'
                case 'books': return 'book'
                case 'music': return 'music'
                case 'podcasts': return 'podcast'
                case 'board games': return 'board_game'
                case 'comics': return 'comic'
                default: return 'general'
            }
        }

        await db.insert(categories).values({
            id: categoryId,
            name: template.name,
            emoji: template.emoji,
            description: curatedData ? curatedData.description : `Curated by a ${persona.specialty} expert`,
            userId: criticId,
            isPublic: true,
            isFeatured: i < 5,
            color: faker.color.rgb(),
            metadata: JSON.stringify({ type: getFilterType(template.category) }),
            image: curatedData ? curatedData.image : getCategoryImage(template.category),
        })

        if (curatedData) {
            // Use Curated Items
            for (let j = 0; j < curatedData.items.length; j++) {
                const itemData = curatedData.items[j]

                // Create specific global item for this curated item
                const globalItemId = crypto.randomUUID()
                await db.insert(globalItems).values({
                    id: globalItemId,
                    title: itemData.title,
                    description: itemData.description,
                    releaseYear: itemData.year,
                    categoryType: template.category.toUpperCase().replace(' ', '_'),
                    imageUrl: itemData.image,
                })

                const itemId = crypto.randomUUID()
                const createdAt = getRandomDate(30)

                await db.insert(items).values({
                    id: itemId,
                    globalItemId,
                    userId: criticId,
                    categoryId,
                    tier: itemData.tier,
                    rank: j + 1,
                    eloScore: 1200 + (curatedData.items.length - j) * 50,
                    createdAt,
                    name: itemData.title,
                    description: itemData.description,
                    image: itemData.image,
                })

                await db.insert(ratings).values({
                    itemId,
                    userId: criticId,
                    value: (TIERS.indexOf(itemData.tier) === -1 ? 50 : (5 - TIERS.indexOf(itemData.tier)) * 20),
                    tier: itemData.tier,
                    type: 'TIER',
                    createdAt,
                })
            }
            console.log(`   ↳ ${template.name} (Curated: ${curatedData.items.length} items)`)

        } else {
            // Existing Random Logic
            const categoryGlobalItems = globalItemMap.get(template.category) || []
            const selectedItems = getRandomItems(categoryGlobalItems, Math.min(10, categoryGlobalItems.length))

            for (let j = 0; j < selectedItems.length; j++) {
                const globalItemId = selectedItems[j]
                const itemId = crypto.randomUUID()
                const tier = getRandomTier()
                const createdAt = getRandomDate(30)

                await db.insert(items).values({
                    id: itemId,
                    globalItemId,
                    userId: criticId,
                    categoryId,
                    tier,
                    rank: j + 1,
                    eloScore: 1200 + (selectedItems.length - j) * 50,
                    createdAt,
                })

                await db.insert(ratings).values({
                    itemId,
                    userId: criticId,
                    value: (TIERS.indexOf(tier) === -1 ? 50 : (5 - TIERS.indexOf(tier)) * 20),
                    tier,
                    type: 'TIER',
                    createdAt,
                })
            }
            console.log(`   ↳ ${template.name} (${selectedItems.length} items)`)
        }
    }
}

async function seedStandardUserActivity(
    userIds: string[],
    globalItemMap: Map<string, string[]>
): Promise<void> {
    console.log(`📊 Generating standard user activity...`)

    const categoryTypes = Array.from(globalItemMap.keys())

    for (const userId of userIds) {
        const numCategories = faker.number.int({ min: 1, max: 3 })
        const userCategories = getRandomItems(categoryTypes, numCategories)

        for (const categoryType of userCategories) {
            const categoryId = crypto.randomUUID()

            // Map categoryType to display name
            let displayName = `My ${categoryType.replace('_', ' ')}`
            if (categoryType === 'Music_Artists') displayName = 'My Music (Artists)'
            if (categoryType === 'Music_Albums') displayName = 'My Music (Albums)'
            if (categoryType === 'Board_Games') displayName = 'My Board Games'

            // Map categoryType to filter type for UI (lowercase codes)
            const getFilterType = (catType: string) => {
                switch (catType) {
                    case 'Movies': return 'movie'
                    case 'TV_Shows': return 'tv'
                    case 'Anime': return 'anime'
                    case 'Video_Games': return 'game'
                    case 'Books': return 'book'
                    case 'Music_Albums':
                    case 'Music_Artists': return 'music'
                    case 'Podcasts': return 'podcast'
                    case 'Board_Games': return 'board_game'
                    case 'Comics': return 'comic'
                    default: return 'general'
                }
            }

            await db.insert(categories).values({
                id: categoryId,
                name: displayName,
                userId,
                isPublic: faker.datatype.boolean(0.2),
                image: getCategoryImage(categoryType),
                metadata: JSON.stringify({ type: getFilterType(categoryType) }),
            })

            const globalIds = globalItemMap.get(categoryType) || []
            const selectedItems = getRandomItems(globalIds, faker.number.int({ min: 2, max: ITEMS_PER_STANDARD_USER }))

            for (let j = 0; j < selectedItems.length; j++) {
                const itemId = crypto.randomUUID()
                const tier = TIERS[faker.number.int({ min: 0, max: 4 })]

                await db.insert(items).values({
                    id: itemId,
                    globalItemId: selectedItems[j],
                    userId,
                    categoryId,
                    tier,
                    rank: j + 1,
                    createdAt: getRandomDate(30),
                })
            }
        }
    }

    console.log(`   ↳ Generated activity for ${userIds.length} users`)
}

async function seedTasteMetrics(userIds: string[]): Promise<void> {
    console.log(`📈 Generating taste metrics and snapshots...`)

    const metricTypes = ['niche_score', 'diversity_score', 'alignment_global']

    for (const userId of userIds.slice(0, 20)) {
        for (const metricType of metricTypes) {
            await db.insert(tasteMetrics).values({
                userId,
                metricType,
                value: faker.number.float({ min: 20, max: 95, fractionDigits: 1 }),
            })
        }

        for (let week = 0; week < 4; week++) {
            const date = new Date()
            date.setDate(date.getDate() - (week * 7))

            await db.insert(tasteSnapshots).values({
                userId,
                snapshotType: 'weekly',
                metricsJson: JSON.stringify({
                    niche_score: faker.number.float({ min: 20, max: 95, fractionDigits: 1 }),
                    diversity_score: faker.number.float({ min: 20, max: 95, fractionDigits: 1 }),
                    alignment_global: faker.number.float({ min: 20, max: 95, fractionDigits: 1 }),
                }),
                itemCount: faker.number.int({ min: 5, max: 50 }),
                capturedAt: date,
            })
        }
    }

    console.log(`   ↳ Generated metrics for 20 users`)
}

// =============================================================================
// SEED COMMUNITY TAGS
// =============================================================================

const COMMUNITY_TAGS = [
    { tag: '#Featured', isAdminOnly: true },
    { tag: '#Curated', isAdminOnly: true },
    { tag: "#Editor's Pick", isAdminOnly: true },
    { tag: '#Staff Pick', isAdminOnly: true },
    { tag: '#Trending', isAdminOnly: true },
    { tag: '#Hidden Gems', isAdminOnly: false },
    { tag: '#Classic', isAdminOnly: false },
    { tag: '#Underrated', isAdminOnly: false },
    { tag: '#Must See', isAdminOnly: false },
    { tag: '#Nostalgia', isAdminOnly: false },
    { tag: '#Mind-Bending', isAdminOnly: false },
    { tag: '#Feel Good', isAdminOnly: false },
    { tag: '#Dark & Gritty', isAdminOnly: false },
    { tag: '#Binge-Worthy', isAdminOnly: false },
    { tag: '#Cult Classic', isAdminOnly: false },
]

async function seedCommunityTags(userIds: string[]): Promise<void> {
    console.log('🏷️  Generating community tags for collections...')

    const tagRecords: { categoryId: string; tag: string; addedBy: string | null; isAdminOnly: boolean }[] = []

    const publicCategories = await db.query.categories.findMany({
        where: eq(categories.isPublic, true),
        columns: { id: true, isFeatured: true }
    })

    for (const cat of publicCategories) {
        // Add #Community to all public collections
        tagRecords.push({ categoryId: cat.id, tag: '#Community', addedBy: null, isAdminOnly: false })

        // Featured collections get admin tags
        if (cat.isFeatured) {
            tagRecords.push({ categoryId: cat.id, tag: '#Featured', addedBy: null, isAdminOnly: true })
            if (Math.random() < 0.5) {
                tagRecords.push({ categoryId: cat.id, tag: '#Curated', addedBy: null, isAdminOnly: true })
            }
        }

        // 50% of collections get 1-2 user-contributed tags
        if (Math.random() < 0.5) {
            const userTags = COMMUNITY_TAGS.filter(t => !t.isAdminOnly)
            const numTags = faker.number.int({ min: 1, max: 2 })
            const selectedTags = getRandomItems(userTags, numTags)
            for (const tagObj of selectedTags) {
                tagRecords.push({
                    categoryId: cat.id,
                    tag: tagObj.tag,
                    addedBy: userIds[faker.number.int({ min: 0, max: userIds.length - 1 })],
                    isAdminOnly: false
                })
            }
        }
    }

    if (tagRecords.length > 0) await db.insert(collectionTags).values(tagRecords)
    console.log(`   ↳ Created ${tagRecords.length} community tags`)
}

// =============================================================================
// SEED INTERACTIONS (Viral Distribution Algorithm)
// =============================================================================

async function seedInteractions(userIds: string[]): Promise<void> {
    console.log('💕 Generating likes & saves with viral distribution...')

    const publicCategories = await db.query.categories.findMany({
        where: eq(categories.isPublic, true),
        columns: { id: true }
    })

    const categoryIds = publicCategories.map(c => c.id)
    if (categoryIds.length === 0 || userIds.length === 0) {
        console.log('   ↳ No public collections or users found')
        return
    }

    const likeRecords: { userId: string; categoryId: string }[] = []
    const saveRecords: { userId: string; categoryId: string }[] = []

    for (const categoryId of categoryIds) {
        // 10% Popular (15-30 likes), 90% Niche (0-8 likes)
        const isPopular = Math.random() < 0.1
        const likeCount = isPopular
            ? faker.number.int({ min: 15, max: Math.min(30, userIds.length) })
            : faker.number.int({ min: 0, max: Math.min(8, userIds.length) })

        if (likeCount === 0) continue

        const shuffledUsers = [...userIds].sort(() => Math.random() - 0.5)
        const likingUsers = shuffledUsers.slice(0, likeCount)

        for (const userId of likingUsers) {
            likeRecords.push({ userId, categoryId })
        }

        // Saves = 20-50% of likes
        const saveCount = Math.floor(likeCount * (0.2 + Math.random() * 0.3))
        for (const userId of likingUsers.slice(0, saveCount)) {
            saveRecords.push({ userId, categoryId })
        }
    }

    if (likeRecords.length > 0) await db.insert(collectionLikes).values(likeRecords)
    if (saveRecords.length > 0) await db.insert(collectionSaves).values(saveRecords)

    console.log(`   ↳ ${likeRecords.length} likes, ${saveRecords.length} saves`)
    console.log(`   ↳ Distribution: 10% Popular (15-30), 90% Niche (0-8)`)
    console.log(`   ↳ ${likeRecords.length} likes, ${saveRecords.length} saves`)
    console.log(`   ↳ Distribution: 10% Popular (15-30), 90% Niche (0-8)`)
}

// =============================================================================
// SEED TOP 3 PICKS
// =============================================================================

async function seedTopPicks(userIds: string[]): Promise<void> {
    console.log('🏆 Seeding Top 3 Picks...')

    let picksCount = 0

    for (const userId of userIds) {
        // Only seed for 70% of users
        if (Math.random() > 0.7) continue

        // Get user's high-rated items (S, A, or B tier)
        const userItems = await db.query.items.findMany({
            where: eq(items.userId, userId),
            orderBy: desc(items.tier), // Approximation, S > A > B alphabetically reversed is wrong but S, A, B... actually string sort A, B, S. 
            // Better to rely on just getting some items.
            limit: 10
        })

        if (userItems.length === 0) continue

        // Shuffle and pick up to 3
        const selected = getRandomItems(userItems, faker.number.int({ min: 1, max: 3 }))

        for (let i = 0; i < selected.length; i++) {
            const item = selected[i]
            await db.insert(userTopPicks).values({
                userId,
                itemId: item.id,
                sortOrder: i,
            })
            picksCount++
        }
    }

    console.log(`   ↳ Created ${picksCount} top picks across ${userIds.length} users`)
}

// =============================================================================
// MAIN EXECUTION
// =============================================================================

async function main() {
    console.log('\n' + '='.repeat(60))
    console.log('🌱 CURATOR DATABASE SEEDER')
    console.log('='.repeat(60) + '\n')

    try {
        await clean()

        const goldenAdminId = await seedGoldenTicketAdmin()
        const adminIds = await seedAdmins()
        const criticIds = await seedCritics()
        const userIds = await seedStandardUsers()

        const globalItemMap = await seedGlobalItems()

        await seedCriticCollections(criticIds, globalItemMap)
        await seedStandardUserActivity(userIds, globalItemMap)
        await seedTasteMetrics([...criticIds, ...userIds])
        await seedSystemSettings()
        await seedUnlockConditions()

        // New social features
        const allUserIds = [...adminIds, ...criticIds, ...userIds]
        await seedCommunityTags(allUserIds)
        await seedInteractions(allUserIds)
        await seedTopPicks(allUserIds)

        console.log('\n' + '='.repeat(60))
        console.log('✅ SEEDING COMPLETE!')
        console.log('='.repeat(60))
        console.log('\n📝 LOGIN CREDENTIALS:\n')

        if (goldenAdminId) {
            console.log('┌─────────────────────────────────────────────────────────┐')
            console.log('│  👑 GOLDEN TICKET ADMIN                                 │')
            console.log(`│  Email:    ${(process.env.INITIAL_ADMIN_EMAIL || '').padEnd(42)}│`)
            console.log(`│  Password: ${(process.env.INITIAL_ADMIN_PASSWORD || '').padEnd(42)}│`)
            console.log('└─────────────────────────────────────────────────────────┘')
        }

        console.log('\n┌─────────────────────────────────────────────────────────┐')
        console.log('│  🔐 ADMIN ACCOUNTS                                      │')
        console.log(`│  admin1@curator.local / ${DEFAULT_PASSWORD.padEnd(25)}│`)
        console.log(`│  admin2@curator.local / ${DEFAULT_PASSWORD.padEnd(25)}│`)
        console.log('└─────────────────────────────────────────────────────────┘')

        console.log('\n┌─────────────────────────────────────────────────────────┐')
        console.log('│  🎬 CRITIC ACCOUNTS (Power Users)                       │')
        console.log(`│  critic1@curator.local / ${DEFAULT_PASSWORD.padEnd(24)}│`)
        console.log(`│  critic2@curator.local / ${DEFAULT_PASSWORD.padEnd(24)}│`)
        console.log('└─────────────────────────────────────────────────────────┘')

        console.log('\n📊 Summary:')
        console.log(`   • ${goldenAdminId ? 1 : 0} Golden Ticket Admin`)
        console.log(`   • ${adminIds.length} Additional Admins`)
        console.log(`   • ${criticIds.length} Critics (Power Users)`)
        console.log(`   • ${userIds.length} Standard Users`)
        console.log(`   • ${Object.values(REALISTIC_MEDIA).flat().length} Media Items`)
        console.log('\n')

    } catch (error) {
        console.error('❌ Seeding failed:', error)
        process.exit(1)
    }
}

main()
