'use server';

import { auth } from '@/lib/auth'; // BetterAuth Server Instance
import { db } from '@/lib/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { headers } from 'next/headers';

/**
 * Marks the user's password change as complete by ensuring the flag is false.
 * Note: The actual password update happens via client-side authClient, 
 * but we need a server action to securely update this custom field.
 */
export async function completeForcePasswordChange() {
    const session = await auth.api.getSession({
        headers: await headers()
    });

    if (!session) {
        throw new Error("Unauthorized");
    }

    // Update the flag in the database
    await db.update(users)
        .set({ requiredPasswordChange: false })
        .where(eq(users.id, session.user.id));

    return { success: true };
}

export async function getGuestUserId() {
    const session = await auth.api.getSession({
        headers: await headers()
    });
    return session?.user?.id;
}
