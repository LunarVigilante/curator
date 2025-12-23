import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@/db/schema";
import { fromNodeHeaders } from "better-auth/node";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
    // 1. Verify Admin
    const session = await auth.api.getSession({
        headers: req.headers
    });

    if (!session || session.user.role !== 'ADMIN') {
        return new NextResponse("Unauthorized", { status: 401 });
    }

    const { email, name, password } = await req.json();

    // 2. Create User via BetterAuth API (Server Side)
    // We can use the exposed API method, effectively acting as "register".
    // Since we don't have the "block all signups" hook anymore (removed for seeding), this works.
    // If we re-add the hook, we need to bypass it or whitelist "admin creation".

    // For now, since the hook is GONE, anyone can register if they hit the endpoint.
    // We MUST secure that. 
    // I will use direct DB insertion + manual password hash if possible, 
    // OR just rely on auth key. 
    // BetterAuth doesn't easily expose hash function in public API.

    // Let's use `auth.api.signUpEmail` but we need to prevent PUBLIC access.
    // I will re-implement the Middleware restriction for `/api/auth/sign-up`.

    try {
        const newUser = await auth.api.signUpEmail({
            body: {
                email,
                password,
                name,
                role: 'USER'
            }
        });

        if (newUser) {
            // Force Password Change
            await db.update(users)
                .set({ requiredPasswordChange: true })
                .where(eq(users.email, email));

            return NextResponse.json(newUser);
        }
        return new NextResponse("Failed to create user", { status: 500 });

    } catch (err: any) {
        return new NextResponse(err.message || "Error", { status: 500 });
    }
}
