import { db } from '@/lib/db';
import { users, globalItems, categories } from '@/db/schema';
import { eq, and, isNull } from 'drizzle-orm';

async function main() {
    console.log('🌱 Seeding database...');

    // 1. Admin User
    const adminEmail = 'admin@example.com';
    const existingUser = await db.select().from(users).where(eq(users.email, adminEmail)).get();

    if (!existingUser) {
        console.log('Creating Admin User...');
        await db.insert(users).values({
            id: crypto.randomUUID(),
            name: 'Admin User',
            email: adminEmail,
            emailVerified: true,
            role: 'ADMIN',
            createdAt: new Date(),
            updatedAt: new Date()
        });
        console.log(`✅ Admin created: ${adminEmail}`);
    } else {
        console.log('✅ Admin already exists.');
    }

    // 2. Stock Catalog
    console.log('📦 Seeding Stock Catalog...');

    const catalog = [
        {
            name: 'Movies',
            type: 'MOVIE',
            items: [
                { title: 'The Godfather', year: 1972, img: 'https://placehold.co/400x600?text=The+Godfather' },
                { title: 'Pulp Fiction', year: 1994, img: 'https://placehold.co/400x600?text=Pulp+Fiction' },
                { title: 'Spirited Away', year: 2001, img: 'https://placehold.co/400x600?text=Spirited+Away' },
                { title: 'Dune: Part Two', year: 2024, img: 'https://placehold.co/400x600?text=Dune+Part+Two' },
                { title: 'The Dark Knight', year: 2008, img: 'https://placehold.co/400x600?text=The+Dark+Knight' },
            ]
        },
        {
            name: 'Games',
            type: 'GAME',
            items: [
                { title: 'Elden Ring', year: 2022, img: 'https://placehold.co/400x600?text=Elden+Ring' },
                { title: 'The Legend of Zelda: Breath of the Wild', year: 2017, img: 'https://placehold.co/400x600?text=BOTW' },
                { title: 'The Last of Us Part I', year: 2022, img: 'https://placehold.co/400x600?text=The+Last+of+Us' },
                { title: 'Minecraft', year: 2011, img: 'https://placehold.co/400x600?text=Minecraft' },
                { title: 'Red Dead Redemption 2', year: 2018, img: 'https://placehold.co/400x600?text=RDR2' },
            ]
        },
        {
            name: 'Books',
            type: 'BOOK',
            items: [
                { title: 'Dune', year: 1965, img: 'https://placehold.co/400x600?text=Dune' },
                { title: '1984', year: 1949, img: 'https://placehold.co/400x600?text=1984' },
                { title: 'The Hobbit', year: 1937, img: 'https://placehold.co/400x600?text=The+Hobbit' },
                { title: 'The Great Gatsby', year: 1925, img: 'https://placehold.co/400x600?text=Great+Gatsby' },
                { title: 'Project Hail Mary', year: 2021, img: 'https://placehold.co/400x600?text=Project+Hail+Mary' },
            ]
        }
    ];

    for (const cat of catalog) {
        // Upsert Category (System Category: userId is null)
        // Check existence by name + null userId
        let categoryId: string;
        const existingCat = await db.select().from(categories)
            .where(and(eq(categories.name, cat.name), isNull(categories.userId)))
            .get();

        if (existingCat) {
            categoryId = existingCat.id;
            console.log(`   Category exists: ${cat.name}`);
        } else {
            categoryId = crypto.randomUUID();
            await db.insert(categories).values({
                id: categoryId,
                name: cat.name,
                isPublic: true,
                isFeatured: true,
                sortOrder: 0,
                createdAt: new Date()
            });
            console.log(`   Category created: ${cat.name}`);
        }

        // Insert Global Items
        for (const item of cat.items) {
            const externalId = `seed-${cat.type.toLowerCase()}-${item.title.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;

            // Check existence
            const existingItem = await db.select().from(globalItems).where(eq(globalItems.externalId, externalId)).get();

            if (!existingItem) {
                await db.insert(globalItems).values({
                    id: crypto.randomUUID(),
                    externalId,
                    title: item.title,
                    releaseYear: item.year,
                    categoryType: cat.type,
                    imageUrl: item.img,
                    createdAt: new Date()
                });
                console.log(`      + Added item: ${item.title}`);
            }
        }
    }

    console.log('🌱 Seeding process finished.');
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
