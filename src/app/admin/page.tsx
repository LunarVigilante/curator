import { getSettings } from '@/lib/actions/settings';
import AdminDashboardClient from '@/components/admin/AdminDashboardClient';
import { auth } from '@/lib/auth'; // Server auth
import { headers } from 'next/headers';
import AdminGuard from '@/components/auth/AdminGuard';

export default async function AdminPage() {
    const session = await auth.api.getSession({
        headers: await headers()
    });

    // Server-side: Optional check. We can keep it or remove it. 
    // If we remove it, we rely entirely on Client Guard.
    // User requested "refactor the AdminRoute... wrapper... Handle Loading State".
    // This implies moving to Client Guard for better UX.
    // However, for security, we usually want double protection.
    // The issue "kicked back... even though logged in" suggests server might be seeing 'null' session occasionally?
    // Let's relax server check to allow Client Guard to spin if needed, OR just return early.
    // But since this is a Server Component, if we return early, we send HTML to client.

    // Strategy: Pass session check to client guard.
    // We'll try to fetch settings, if it fails (due to auth), we just pass empty/null and let Guard redirect.

    let systemSettings: Record<string, string> = {};
    try {
        // Only fetch if looks like admin, otherwise fetch might throw or return empty
        if (session?.user?.role === 'ADMIN') {
            systemSettings = await getSettings();
        }
    } catch (e) {
        console.error("Failed to load settings:", e);
    }

    return (
        <AdminGuard>
            <AdminDashboardClient systemSettings={systemSettings} />
        </AdminGuard>
    );
}
