import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@/lib/db";
import * as schema from "@/db/schema";

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
    emailAndPassword: {
        enabled: true,
        // We will block public sign-ups via hooks or API route logic
        // But preventing 'signUp' at config level:
        // Note: Check docs for specific disable flag if exists, otherwise hooks.
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
