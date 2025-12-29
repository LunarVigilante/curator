/**
 * Supabase Auth Handler
 * 
 * This file previously used BetterAuth's Next.js handler.
 * Supabase Auth is now handled via the Supabase client directly.
 * 
 * This route is kept as a placeholder/stub for backward compatibility.
 * All auth operations should go through:
 * - Server: createClient() from '@/lib/supabase/server'
 * - Client: createBrowserClient() from '@/lib/supabase/client'
 */

import { NextResponse } from 'next/server';

export async function GET() {
    return NextResponse.json({
        message: 'Auth is handled by Supabase',
        docs: 'https://supabase.com/docs/guides/auth'
    });
}

export async function POST() {
    return NextResponse.json({
        message: 'Auth is handled by Supabase',
        docs: 'https://supabase.com/docs/guides/auth'
    });
}
