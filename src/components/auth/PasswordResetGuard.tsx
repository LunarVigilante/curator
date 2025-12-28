'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { authClient } from '@/lib/auth-client';

export function PasswordResetGuard() {
    const { data: session } = authClient.useSession();
    const router = useRouter();
    const pathname = usePathname();
    const [isRedirecting, setIsRedirecting] = useState(false);

    useEffect(() => {
        if (!session) return;

        // Cast to any because `requiredPasswordChange` is a custom field
        const user = session.user as any;

        if (user.requiredPasswordChange) {
            // Allow access ONLY to the change-password page
            if (pathname !== '/change-password') {
                // Prevent infinite redirect loops or redundant pushes
                if (!isRedirecting) {
                    // Wrap in setTimeout to avoid setting state during render
                    setTimeout(() => {
                        setIsRedirecting(true);
                        router.replace('/change-password');
                    }, 0);
                }
            }
        }
    }, [session, pathname, router, isRedirecting]);

    // This component renders nothing; it just watches navigation
    return null;
}
