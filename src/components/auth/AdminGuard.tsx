'use client';

import { useEffect, useState } from 'react';
import { auth } from "@/lib/auth-client";

export default function AdminGuard({ children }: { children: React.ReactNode }) {
    const [isLoading, setIsLoading] = useState(true);
    const [isAdmin, setIsAdmin] = useState(false);

    useEffect(() => {
        async function checkAdmin() {
            try {
                const { data: { session } } = await auth.auth.getSession();
                if (!session) {
                    setIsLoading(false);
                    return;
                }

                const { data: profile } = await auth
                    .from('profiles')
                    .select('role')
                    .eq('id', session.user.id)
                    .single();

                // Check strict ADMIN role
                if (profile?.role === 'ADMIN') {
                    setIsAdmin(true);
                }
            } catch (error) {
                console.error("Admin check failed:", error);
            } finally {
                setIsLoading(false);
            }
        }

        checkAdmin();
    }, []);

    // 1. If loading, hide everything
    if (isLoading) {
        return null; // Or a spinner
    }

    // 2. If NOT admin, return null
    if (!isAdmin) {
        return null;
    }

    // 3. If Admin, show the content
    return <>{children}</>;
}
