import { db } from './src/lib/db';
import { items, categories } from './src/db/schema';
import { eq } from 'drizzle-orm';

async function addTestItems() {
    console.log('Adding test items to Anime category...');

    // Find the Anime category
    const animeCategory = await db.query.categories.findFirst({
        where: eq(categories.name, 'Anime and Manga')
    });

    if (!animeCategory) {
        console.error('Anime and Manga category not found');
        return;
    }

    const testItems = [
        { name: 'One Piece', image: 'https://placehold.co/100x100/ff0000/white?text=OP' },
        { name: 'Naruto', image: 'https://placehold.co/100x100/ff9900/white?text=N' },
        { name: 'Dragon Ball Z', image: 'https://placehold.co/100x100/ffff00/black?text=DBZ' },
        { name: 'Death Note', image: 'https://placehold.co/100x100/000000/white?text=DN' },
        { name: 'Attack on Titan', image: 'https://placehold.co/100x100/8b0000/white?text=AoT' },
        { name: 'My Hero Academia', image: 'https://placehold.co/100x100/00ff00/black?text=MHA' },
    ];

    for (const item of testItems) {
        await db.insert(items).values({
            ...item,
            categoryId: animeCategory.id
        }).onConflictDoNothing();
    }

    console.log('Test items added successfully!');
}

addTestItems().catch(console.error);
