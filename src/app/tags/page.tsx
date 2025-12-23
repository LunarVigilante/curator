import { getTags } from '@/lib/actions/tags'
import TagManager from '@/components/tags/TagManager'
import PageContainer from '@/components/PageContainer'

export default async function TagsPage() {
    const tags = await getTags()

    return (
        <PageContainer>
            <h1 className="text-3xl font-bold mb-2">Manage Tags</h1>
            <p className="text-muted-foreground mb-8">
                Create and manage tags to organize your items across categories.
            </p>
            <TagManager initialTags={tags} />
        </PageContainer>
    )
}
