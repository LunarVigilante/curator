import { getFollowing } from '@/lib/actions/interactions';
import { FollowingClient } from '@/components/browse/FollowingClient';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';

export default async function FollowingPage() {
    const session = await getSession();

    if (!session?.user?.id) {
        redirect('/login');
    }

    const { data: users, error } = await getFollowing();

    if (error) {
        redirect('/login');
    }

    return (
        <div className="container mx-auto px-4 py-8">
            <FollowingClient users={users} />
        </div>
    );
}
