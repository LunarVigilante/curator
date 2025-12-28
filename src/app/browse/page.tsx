import { getPublicCategories } from '@/lib/actions/categories';
import { BrowseClient } from '@/components/browse/BrowseClient';
import { getBatchInteractionStatus, getBatchLikeCounts } from '@/lib/actions/interactions';
import { getBatchCollectionTags } from '@/lib/actions/communityTags';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';

export default async function BrowsePage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string; type?: string; sort?: string }> }) {
    const params = await searchParams;
    const query = params.q || '';
    const page = parseInt(params.page || '1');
    const type = params.type || 'All';
    const sort = params.sort || 'newest';

    // Get session for admin check
    const session = await auth.api.getSession({ headers: await headers() });
    const isAdmin = (session?.user as any)?.role === 'ADMIN';

    // Fetch categories
    const { data: categories, metadata } = await getPublicCategories(query, page, undefined, type, sort);

    // Fetch interaction data and tags for all categories
    const categoryIds = categories.map((c: { id: string }) => c.id);
    const [interactionStatus, likeCounts, tagsMap] = await Promise.all([
        getBatchInteractionStatus(categoryIds),
        getBatchLikeCounts(categoryIds),
        getBatchCollectionTags(categoryIds)
    ]);

    return (
        <div className="container mx-auto px-4 py-8">
            <BrowseClient
                categories={categories}
                query={query}
                type={type}
                sort={sort}
                metadata={metadata}
                interactionStatus={interactionStatus}
                likeCounts={likeCounts}
                tagsMap={tagsMap}
                isAdmin={isAdmin}
            />
        </div>
    );
}
