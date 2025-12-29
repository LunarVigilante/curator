import { getSettings } from '@/lib/actions/settings';
import AdminDashboardClient from '@/components/admin/AdminDashboardClient';
import { getSession } from '@/lib/auth';
import AdminGuard from '@/components/auth/AdminGuard';

export default async function AdminPage() {
    const session = await getSession();

    let systemSettings: Record<string, string> = {};
    try {
        // Only fetch if looks like admin, otherwise fetch might throw or return empty
        if (session?.profile?.role === 'ADMIN') {
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
