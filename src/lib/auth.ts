import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@/lib/db";
import * as schema from "@/db/schema";
import { seedDefaultCategories } from "./actions/categories";
import { sendPasswordResetEmail, sendVerificationEmail } from './emailAdapter';
import { hash, compare } from 'bcryptjs';
import { eq } from 'drizzle-orm';

export const auth = betterAuth({
    database: drizzleAdapter(db, {
        provider: "sqlite",
        schema: {
            ...schema,
            user: schema.users,
            session: schema.sessions,
            account: schema.accounts,
            verification: schema.verifications
        }
    }),
    databaseHooks: {
        user: {
            create: {
                after: async (user) => {
                    await seedDefaultCategories(user.id);
                }
            }
        },
        session: {
            create: {
                before: async (session) => {
                    // Check if user is locked out
                    const user = await db.query.users.findFirst({
                        where: eq(schema.users.id, session.userId)
                    });
                    if (user?.isLockedOut) {
                        throw new Error('This account has been locked. Please contact an administrator.');
                    }
                    // Return undefined to proceed normally
                    return;
                }
            }
        }
    },
    emailAndPassword: {
        enabled: true,
        // Use bcrypt for password hashing (compatible with seed script)
        password: {
            hash: async (password: string) => {
                return await hash(password, 10);
            },
            verify: async ({ password, hash: storedHash }) => {
                return await compare(password, storedHash);
            }
        },
        // Injected email adapter - no direct SystemConfigService dependency
        sendResetPassword: sendPasswordResetEmail,
    },
    emailVerification: {
        enabled: true,
        autoSignInAfterVerification: true,
        sendOnSignUp: true,
        // Injected email adapter - no direct SystemConfigService dependency
        sendVerificationEmail: sendVerificationEmail,
    },
    user: {
        additionalFields: {
            role: {
                type: "string",
                defaultValue: "USER"
            },
            requiredPasswordChange: {
                type: "boolean",
                defaultValue: false
            }
        }
    }
});
