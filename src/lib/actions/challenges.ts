'use server'

import { db } from '@/lib/db';
import { categories, items, globalItems, userChallenges, ratings } from '@/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';

// ============================================================================
// TEMPLATE LOGIC (Legacy/Cloning)
// ============================================================================

export async function getChallengeTemplates() {
    return await db.query.categories.findMany({
        where: eq(categories.isTemplate, true),
        orderBy: (categories, { desc }) => [desc(categories.createdAt)]
    });
}

export async function acceptChallengeTemplate(templateId: string) {
    const session = await auth.api.getSession({
        headers: await headers()
    });
    if (!session?.user?.id) throw new Error("Unauthorized");
    const userId = session.user.id;

    // 1. Fetch Template
    const template = await db.query.categories.findFirst({
        where: eq(categories.id, templateId)
    });

    if (!template || !template.isTemplate) throw new Error("Challenge template not found");

    // 2. Create User Category (Clone)
    const newCategoryId = crypto.randomUUID();
    await db.insert(categories).values({
        id: newCategoryId,
        name: template.name,
        description: template.description,
        image: template.image,
        color: template.color,
        emoji: template.emoji,
        metadata: template.metadata,
        userId: userId,
        isTemplate: false,
        isPublic: true,
    });

    // 3. Clone Items from Template
    const templateItems = await db.query.items.findMany({
        where: eq(items.categoryId, templateId)
    });

    if (templateItems.length > 0) {
        await db.insert(items).values(
            templateItems.map(ti => ({
                id: crypto.randomUUID(),
                name: ti.name,
                description: ti.description,
                image: ti.image,
                metadata: ti.metadata,
                globalItemId: ti.globalItemId,
                userId: userId,
                categoryId: newCategoryId,
                eloScore: 1200,
                status: 'ACTIVE'
            }))
        );
    }

    revalidatePath('/');
    revalidatePath(`/categories/${newCategoryId}`);
    return { categoryId: newCategoryId };
}

export async function toggleCategoryTemplate(categoryId: string, isTemplate: boolean) {
    const session = await auth.api.getSession({
        headers: await headers()
    });
    if (session?.user?.role !== 'ADMIN') throw new Error("Admin access required");

    await db.update(categories)
        .set({ isTemplate })
        .where(eq(categories.id, categoryId));

    revalidatePath('/admin');
    revalidatePath(`/categories/${categoryId}`);
}

// ============================================================================
// COMMUNITY CHALLENGE LOGIC (Join/Progress)
// ============================================================================

export async function toggleCategoryChallenge(categoryId: string, isChallenge: boolean) {
    const session = await auth.api.getSession({
        headers: await headers()
    });
    if (!session?.user?.id || session.user.role !== 'ADMIN') {
        throw new Error("Unauthorized");
    }

    await db.update(categories)
        .set({ isChallenge })
        .where(eq(categories.id, categoryId));

    revalidatePath('/admin');
    revalidatePath('/browse');
}

export async function joinChallenge(categoryId: string) {
    const session = await auth.api.getSession({
        headers: await headers()
    });
    if (!session?.user?.id) throw new Error("Unauthorized");

    const userId = session.user.id;

    const category = await db.query.categories.findFirst({
        where: and(eq(categories.id, categoryId), eq(categories.isChallenge, true))
    });

    if (!category) throw new Error("Challenge not available");

    // Initialize progress by checking existing ratings
    const categoryItems = await db.query.items.findMany({
        where: eq(items.categoryId, categoryId),
        columns: { id: true, globalItemId: true }
    });

    let progress = 0;
    const globalIds = categoryItems.map(i => i.globalItemId).filter(Boolean) as string[];

    if (globalIds.length > 0) {
        const userCompletedCount = await db
            .select({ count: sql<number>`count(*)` })
            .from(items)
            .innerJoin(ratings, eq(items.id, ratings.itemId))
            .where(and(
                eq(items.userId, userId),
                sql`${items.globalItemId} IN ${globalIds}`
            ))
            .get();
        progress = userCompletedCount?.count || 0;
    }

    const status = (categoryItems.length > 0 && progress >= categoryItems.length) ? 'COMPLETED' : 'ACTIVE';
    const completedAt = status === 'COMPLETED' ? new Date() : null;

    await db.insert(userChallenges).values({
        userId,
        categoryId,
        status,
        progress,
        completedAt,
        joinedAt: new Date(),
    }).onConflictDoUpdate({
        target: [userChallenges.userId, userChallenges.categoryId],
        set: { status, progress, completedAt }
    });

    revalidatePath(`/categories/${categoryId}`);
    revalidatePath('/profile');
}

export async function leaveChallenge(categoryId: string) {
    const session = await auth.api.getSession({
        headers: await headers()
    });
    if (!session?.user?.id) throw new Error("Unauthorized");

    await db.delete(userChallenges)
        .where(and(
            eq(userChallenges.userId, session.user.id),
            eq(userChallenges.categoryId, categoryId)
        ));

    revalidatePath(`/categories/${categoryId}`);
    revalidatePath('/profile');
}

export async function updateChallengeProgress(userId: string, categoryId: string) {
    const challenge = await db.query.userChallenges.findFirst({
        where: and(eq(userChallenges.userId, userId), eq(userChallenges.categoryId, categoryId))
    });

    if (!challenge) return;

    const categoryItems = await db.query.items.findMany({
        where: eq(items.categoryId, categoryId),
        columns: { globalItemId: true }
    });

    const globalIds = categoryItems.map(i => i.globalItemId).filter(Boolean) as string[];
    let progress = 0;

    if (globalIds.length > 0) {
        const userCompletedCount = await db
            .select({ count: sql<number>`count(*)` })
            .from(items)
            .innerJoin(ratings, eq(items.id, ratings.itemId))
            .where(and(
                eq(items.userId, userId),
                sql`${items.globalItemId} IN ${globalIds}`
            ))
            .get();
        progress = userCompletedCount?.count || 0;
    }

    const status = (categoryItems.length > 0 && progress >= categoryItems.length) ? 'COMPLETED' : 'ACTIVE';
    const completedAt = status === 'COMPLETED' ? new Date() : null;

    if (challenge.progress !== progress || challenge.status !== status) {
        await db.update(userChallenges)
            .set({ progress, status, completedAt })
            .where(and(eq(userChallenges.userId, userId), eq(userChallenges.categoryId, categoryId)));

        revalidatePath('/profile');
    }
}

export async function getJoinedChallenges(userId: string) {
    return await db.query.userChallenges.findMany({
        where: eq(userChallenges.userId, userId),
        with: {
            category: {
                with: {
                    items: {
                        columns: { id: true }
                    }
                }
            }
        }
    });
}

export async function getChallengeStatus(userId: string, categoryId: string) {
    return await db.query.userChallenges.findFirst({
        where: and(eq(userChallenges.userId, userId), eq(userChallenges.categoryId, categoryId)),
        columns: { status: true, progress: true }
    });
}
