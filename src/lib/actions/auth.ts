'use server';

import { auth } from '@/lib/auth'; // BetterAuth Server Instance
import { db } from '@/lib/db';
import { users, invites } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

/**
 * Marks the user's password change as complete by ensuring the flag is false.
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

export async function register(prevState: any, formData: FormData) {
    const name = formData.get('username') as string;
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;
    const inviteCode = formData.get('inviteCode') as string;

    if (!email || !password || !name || !inviteCode) {
        return { message: 'All fields are required' };
    }

    try {
        // 1. Validate Invite
        const invite = await db.query.invites.findFirst({
            where: and(
                eq(invites.code, inviteCode),
                eq(invites.isUsed, false)
            )
        });

        if (!invite) {
            return { errors: { inviteCode: 'Invalid or expired invite code' } };
        }

        // 2. Create User
        // Note: auth.api.signUpEmail returns data on success, throws on error usually
        const response = await auth.api.signUpEmail({
            body: {
                email,
                password,
                name,
            }
        });

        if (!response || !response.user) {
            return { message: 'Failed to create user' };
        }

        // 3. Consume Invite
        await db.update(invites)
            .set({
                isUsed: true,
                usedBy: response.user.id,
                usedAt: new Date()
            })
            .where(eq(invites.id, invite.id));

    } catch (error: any) {
        console.error("Registration error:", error);
        // Handle BetterAuth errors
        if (error.body?.message) {
            return { message: error.body.message };
        }
        return { message: error.message || 'Something went wrong during registration' };
    }

    redirect('/login?registered=true');
}
