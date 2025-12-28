import { getSavedCollections, getBatchLikeCounts, getBatchInteractionStatus } from '@/lib/actions/interactions';
import { BookmarksClient } from '../../components/browse/BookmarksClient';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';

export default async function BookmarksPage() {
    const session = await auth.api.getSession({ headers: await headers() });

    if (!session?.user?.id) {
        redirect('/login');
    }

    const { data: categories, error } = await getSavedCollections();

    if (error) {
        redirect('/login');
    }

    // Get interaction status and like counts for all saved collections
    const categoryIds = categories.map((c: { id: string }) => c.id);
    const [interactionStatus, likeCounts] = await Promise.all([
        getBatchInteractionStatus(categoryIds),
        getBatchLikeCounts(categoryIds)
    ]);

    return (
        <div className="container mx-auto px-4 py-8">
            <BookmarksClient
                categories={categories}
                interactionStatus={interactionStatus}
                likeCounts={likeCounts}
            />
        </div>
    );
}
