import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import UserSettings from '@/components/settings/UserSettings';
import { Separator } from '@/components/ui/separator';

export default async function SettingsPage() {
    const session = await auth.api.getSession({
        headers: await headers()
    });

    if (!session) {
        redirect('/login');
    }

    const { user } = session;

    return (
        <div className="container mx-auto py-10 max-w-5xl px-4">
            <h1 className="text-3xl font-bold mb-6">Settings</h1>
            <Separator className="my-6" />

            <UserSettings user={user} />
        </div>
    );
}
