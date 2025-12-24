'use server';

import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';

export async function updateUserProfile(data: {
    name?: string;
    email?: string;
    bio?: string;
    image?: string;
    preferences?: any;
}) {
    const session = await auth.api.getSession({
        headers: await headers()
    });

    if (!session) {
        throw new Error("Unauthorized");
    }

    const { name, email, bio, image, preferences } = data;

    // Serialize preferences if provided
    const preferencesString = preferences ? JSON.stringify(preferences) : undefined;

    await db.update(users)
        .set({
            ...(name && { name }),
            ...(email && { email }),
            ...(bio && { bio }),
            ...(image && { image }),
            ...(preferencesString && { preferences: preferencesString }),
        })
        .where(eq(users.id, session.user.id));

    revalidatePath('/settings');
    revalidatePath('/'); // In case bio/name shows up elsewhere
    return { success: true };
}

// TODO: Implement actual deletion logic if needed (cascading deletes usually handled by DB, but file cleanup might be needed)
export async function deleteUserAccount() {
    const session = await auth.api.getSession({
        headers: await headers()
    });

    if (!session) {
        throw new Error("Unauthorized");
    }

    // Since we have ON DELETE CASCADE in schema for related tables (items, sessions, etc.), 
    // deleting the user row should clean up most things.
    // However, we might want to soft-delete or anonymize. For now, strict deletion.

    await db.delete(users).where(eq(users.id, session.user.id));

    return { success: true };
}
