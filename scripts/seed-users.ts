
import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from '../src/db/schema';
import { eq, like, or } from 'drizzle-orm';
import { hash } from 'bcryptjs';

const sqlite = new Database('dev.db');
const db = drizzle(sqlite, { schema });

async function main() {
    console.log('🌱 Seeding Starter Users...');

    const defaultPassword = await hash('start123', 10);

    const starterUsers = [
        {
            name: 'The Cinephile',
            email: 'cinephile@example.com',
            bio: 'Cinema is life. If it’s not 70mm, I’m not interested.',
            image: '/avatars/cinephile.jpg', // Placeholder
            tastes: [
                { title: 'The Godfather', elo: 1200 },
                { title: 'Pulp Fiction', elo: 1150 },
                { title: 'Citizen Kane', elo: 1100 },
                { title: 'Transformers', elo: 800 }, // Dislikes
                { title: 'Fast & Furious', elo: 750 }
            ]
        },
        {
            name: 'The Gamer',
            email: 'gamer@example.com',
            bio: 'RPG addict. 100% completionist or nothing.',
            image: '/avatars/gamer.jpg',
            tastes: [
                { title: 'Elden Ring', elo: 1250 },
                { title: 'The Legend of Zelda: Breath of the Wild', elo: 1200 },
                { title: 'Baldur\'s Gate 3', elo: 1180 },
                { title: 'FIFA', elo: 800 }, // Dislikes
                { title: 'Candy Crush', elo: 700 }
            ]
        },
        {
            name: 'The Pop Culture Fan',
            email: 'popfan@example.com',
            bio: 'Marvel, Harry Potter, and Taylor Swift. Don\'t judge.',
            image: '/avatars/popfan.jpg',
            tastes: [
                { title: 'Marvel', elo: 1200 }, // Might need clearer title mapping
                { title: 'Harry Potter', elo: 1150 },
                { title: 'Avengers', elo: 1180 },
                { title: 'Taylor Swift', elo: 1200 }, // If this is an item
                { title: 'The Godfather', elo: 900 } // Maybe finds it boring
            ]
        }
    ];

    for (const userProfile of starterUsers) {
        // 1. Create User
        console.log(`Creating user: ${userProfile.name}`);

        let user = await db.query.users.findFirst({
            where: eq(schema.users.email, userProfile.email)
        });

        if (!user) {
            const [newUser] = await db.insert(schema.users).values({
                name: userProfile.name,
                email: userProfile.email,
                bio: userProfile.bio,
                image: userProfile.image,
                emailVerified: true
            }).returning();
            user = newUser;

            // Create Account for password login
            await db.insert(schema.accounts).values({
                accountId: user.id,
                userId: user.id,
                providerId: 'credentials',
                password: defaultPassword
            });
        }

        // 2. Create Items / Rankings
        for (const taste of userProfile.tastes) {
            // Find global item
            // We search broadly using 'like' since titles might vary slightly
            let globalItem = await db.query.globalItems.findFirst({
                where: like(schema.globalItems.title, `%${taste.title}%`)
            });

            if (!globalItem) {
                console.log(` - Stock item "${taste.title}" not found. Creating it...`);
                // Create global item if missing
                const [newItem] = await db.insert(schema.globalItems).values({
                    title: taste.title,
                    categoryType: 'POPULAR', // Default
                    releaseYear: 2020, // Default
                    imageUrl: `/images/${taste.title.toLowerCase().replace(/\s/g, '-')}.jpg` // Placeholder
                }).returning();
                globalItem = newItem;
            }

            if (globalItem) {
                // Check if user already has this item
                const existingItem = await db.query.items.findFirst({
                    where: (items, { and, eq }) => and(
                        eq(items.userId, user!.id),
                        eq(items.globalItemId, globalItem.id)
                    )
                });

                if (!existingItem) {
                    await db.insert(schema.items).values({
                        userId: user.id,
                        globalItemId: globalItem.id,
                        name: globalItem.title, // Fallback name
                        image: globalItem.imageUrl,
                        description: globalItem.description,
                        eloScore: taste.elo,
                        status: 'ACTIVE'
                    });
                    console.log(` - Rated "${globalItem.title}" (${taste.elo})`);
                }
            }
        }
    }

    console.log('✅ Starter users seeded!');
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
