import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import fs from 'fs';
import path from 'path';

// Manual env loading
const envPath = path.resolve(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
    const envConfig = fs.readFileSync(envPath, 'utf8');
    envConfig.split('\n').forEach(line => {
        const [key, value] = line.split('=');
        if (key && value) {
            let cleanValue = value.trim();
            if (cleanValue.startsWith('"') && cleanValue.endsWith('"')) cleanValue = cleanValue.slice(1, -1);
            if (cleanValue.startsWith("'") && cleanValue.endsWith("'")) cleanValue = cleanValue.slice(1, -1);
            process.env[key.trim()] = cleanValue;
        }
    });
}

async function main() {
    console.log("🌱 Seeding Admin User...");

    const email = "admin@example.com";
    const password = "temporary-password-123";

    // Check if exists
    const existing = await db.query.users.findFirst({
        where: eq(users.email, email)
    });

    if (existing) {
        console.log("⚠️ Admin user already exists.");
        // Optional: Reset password if needed? For now, skip.
        return;
    }

    try {
        // Use BetterAuth API manually or Direct DB?
        // BetterAuth has server-side utilities.
        // We can use auth.api.signUpEmail? But we blocked signUp hook!
        // The hook might trigger even for internal calls? 
        // Hook context `isTrusted` or similar? 
        // If hook blocks, we must insert directly into DB to bypass.

        // However, BetterAuth hashes passwords. We need BetterAuth to hash it.
        // We can use `auth.api.signUpEmail` and momentarily disable the hook in `auth.ts` or pass a flag?
        // No, simplest is to use `auth.api.signUpEmail` and IF the hook blocks, we catch it.
        // BUT, since we WROTE the hook to block `signUp`, it will block.

        // Workaround: We will use the internal hashing utility from better-auth if exposed, 
        // OR we just use the `auth.api` and accept that we need to modify auth.ts to allow this specific email or context.

        // Let's modify auth.ts to ALLOW "admin@example.com".

        // actually, let's try calling it. If it fails, I'll update auth.ts.
        // Wait, I can't easily see if it fails here.

        // I will use direct DB insertion but I need the password hash.
        // Does better-auth expose a hashing utility? 
        // `auth.password.hash`? 

        // Better approach: Since 'better-auth' is installed, let's assume `auth.api.signUpEmail` works if I didn't block it yet (I did).

        // Re-read `auth.ts`. I threw "Public sign-up is disabled."
        // I will update the script to just create the user entry in the DB with a KNOWN hash or use a separate utility.
        // But better-auth uses scrypt or bcrypt.

        // Let's rely on better-auth server functions that might BYPASS hooks?
        // `auth.internal.createUser`?

        // I will assume for now I can try using `auth.api.signUpEmail` and catch the error.
        // Actually, let's just update `auth.ts` to allow if email === 'admin@example.com' before blocking.
        // That's a good backdoor for seeding.

        // But for now, let's write the seed script to try creating it.

        const res = await auth.api.signUpEmail({
            body: {
                email,
                password,
                name: "Admin User",
            },
            // asAdmin: true? No such flag standard.
        });

        if (res) {
            console.log("✅ Admin user created via Auth API.");
            // Now update role and forceChange flag manually
            const user = await db.query.users.findFirst({ where: eq(users.email, email) });
            if (user) {
                await db.update(users).set({
                    role: 'ADMIN',
                    requiredPasswordChange: true
                }).where(eq(users.id, user.id));
                console.log("✅ Admin role and restrictions applied.");
            }
        }

    } catch (e: any) {
        console.error("❌ Failed to seed admin:", e);
        if (e.cause) console.error("Cause:", e.cause);
        if (e.stack) console.error("Stack:", e.stack);
    }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
