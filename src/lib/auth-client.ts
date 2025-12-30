/**
 * Supabase Auth Client
 * 
 * This module provides client-side authentication helpers using Supabase.
 * It replaces the previous BetterAuth client implementation.
 */

import { createBrowserClient } from '@supabase/ssr';

// Create a singleton browser client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);

/**
 * Sign in with email and password
 */
export async function signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
    });
    return { data, error };
}

/**
 * Sign up with email and password
 */
export async function signUp(email: string, password: string, metadata?: { name?: string }) {
    const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
            data: metadata,
        },
    });
    return { data, error };
}

/**
 * Sign out the current user
 */
export async function signOut() {
    const { error } = await supabase.auth.signOut();
    return { error };
}

/**
 * Get the current session
 */
export async function getSession() {
    const { data: { session }, error } = await supabase.auth.getSession();
    return { session, error };
}

/**
 * Get the current user
 */
export async function getUser() {
    const { data: { user }, error } = await supabase.auth.getUser();
    return { user, error };
}

/**
 * Hook to subscribe to auth state changes
 * Use this in React components
 */
export function onAuthStateChange(callback: (event: string, session: any) => void) {
    return supabase.auth.onAuthStateChange(callback);
}

/**
 * Send password reset email
 */
export async function resetPassword(email: string) {
    const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
    });
    return { data, error };
}

/**
 * Update password (for logged-in users or from reset link)
 */
export async function updatePassword(newPassword: string) {
    const { data, error } = await supabase.auth.updateUser({
        password: newPassword,
    });
    return { data, error };
}

// Legacy export for backward compatibility
export const authClient = {
    signIn: async ({ email, password }: { email: string; password: string }) => signIn(email, password),
    signUp: async ({ email, password, name }: { email: string; password: string; name?: string }) =>
        signUp(email, password, { name }),
    signOut,
    getSession,
    getUser,
};

// Export individual methods for direct usage
export { supabase as auth };
