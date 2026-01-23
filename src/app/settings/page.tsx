import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import UserSettings from '@/components/settings/UserSettings';
import { Separator } from '@/components/ui/separator';

export default async function SettingsPage() {
    const session = await getSession();

    if (!session) {
        redirect('/login');
    }

    const mergedUser = {
        id: session.user.id,
        name: session.profile?.name || session.user.email || 'User',
        email: session.user.email || '',
        image: session.profile?.image,
        bio: session.profile?.bio,
        preferences: session.user.user_metadata?.preferences
    };

    return (
        <div className="container mx-auto py-10 max-w-5xl px-4">
            <h1 className="text-3xl font-bold mb-6">Settings</h1>
            <Separator className="my-6" />

            <UserSettings user={mergedUser} />
        </div>
    );
}
