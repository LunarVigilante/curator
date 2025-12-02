import { db } from './src/lib/db.js';
import { categories } from './src/db/schema.js';

async function seed() {
    console.log('Seeding categories...');

    const categoriesData = [
        {
            name: 'Anime',
            description: 'Japanese animated series and films',
            color: '#FF6B9D', // Pink
            image: null
        },
        {
            name: 'Manga',
            description: 'Japanese comics and graphic novels',
            color: '#C77DFF', // Purple
            image: null
        },
        {
            name: 'Video Games',
            description: 'Digital interactive entertainment',
            color: '#4CAF50', // Green
            image: null
        },
        {
            name: 'Food',
            description: 'Culinary delights and cuisine',
            color: '#FF9800', // Orange
            image: null
        },
        {
            name: 'Movies',
            description: 'Films and cinema',
            color: '#2196F3', // Blue
            image: null
        },
        {
            name: 'Music',
            description: 'Songs, albums, and artists',
            color: '#9C27B0', // Deep Purple
            image: null
        },
        {
            name: 'TV',
            description: 'Television series and shows',
            color: '#00BCD4', // Cyan
            image: null
        },
        {
            name: 'Beer',
            description: 'Craft beers and brews',
            color: '#FFC107', // Amber
            image: null
        }
    ];

    await db.delete(categories);
    await db.insert(categories).values(categoriesData);

    console.log(`✓ Seeded ${categoriesData.length} categories`);
}

seed().then(() => process.exit(0)).catch((err) => {
    console.error(err);
    process.exit(1);
});
