import { getCategories } from '@/lib/actions/categories';
import { getFollowedUsers } from '@/lib/actions/social';
import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import MashupClient from './MashupClient';

export default async function MashupPage() {
    const session = await getSession();

    if (!session?.user?.id) {
        redirect('/login');
    }

    const categories = await getCategories();
    const followedUsers = await getFollowedUsers(session.user.id);

    return (
        <div className="min-h-screen bg-[#09090b] selection:bg-blue-600/30">
            <MashupClient categories={categories} followedUsers={followedUsers} />
        </div>
    );
}
