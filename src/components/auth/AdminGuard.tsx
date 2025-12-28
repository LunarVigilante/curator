'use client';

import { authClient } from "@/lib/auth-client";

export default function AdminGuard({ children }: { children: React.ReactNode }) {
    const { data: session, isPending } = authClient.useSession();

    // 1. If loading, hide everything (prevent flashing)
    if (isPending) {
        return null;
    }

    // 2. Safety Check: Must have a user
    if (!session || !session.user) {
        return null;
    }

    // 3. Strict Admin Check
    // Checks for 'admin'/'ADMIN' in the "role" field OR the "groups" array
    const user = session.user as any;
    const hasAdminRole = user.role === 'admin' || user.role === 'ADMIN';
    const hasAdminGroup = Array.isArray(user.groups) && (user.groups.includes('admin') || user.groups.includes('ADMIN'));

    // 4. If NOT admin, return null (Hide the menu/content completely)
    if (!hasAdminRole && !hasAdminGroup) {
        return null;
    }

    // 5. If Admin, show the content
    return <>{children}</>;
}
