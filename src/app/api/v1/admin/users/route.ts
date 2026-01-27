import { getSession, isAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
    // 1. Verify Admin
    const session = await getSession();

    if (!session || !(await isAdmin())) {
        return new NextResponse("Unauthorized", { status: 401 });
    }

    const { email, name, password } = await req.json();

    const supabase = await createClient();

    try {
        // Create user via Supabase Auth Admin API
        // Note: This requires service role key for admin operations
        const { data: authData, error: authError } = await supabase.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: { name }
        });

        if (authError) throw authError;

        // Create profile with required password change flag
        // Use type assertion to bypass type inference for optional fields
        const { error: profileError } = await (supabase as any)
            .from('profiles')
            .upsert({
                id: authData.user.id,
                email,
                name,
                role: 'USER',
            }, { onConflict: 'id' });

        if (profileError) throw profileError;

        return NextResponse.json({
            id: authData.user.id,
            email,
            name,
            role: 'USER'
        });

    } catch (err: any) {
        console.error("Failed to create user:", err);
        return new NextResponse(err.message || "Error", { status: 500 });
    }
}
