import { getTags } from '@/lib/actions/tags'
import TagManager from '@/components/tags/TagManager'

export default async function TagsPage() {
    const tags = await getTags()

    return (
        <div className="container mx-auto py-10">
            <h1 className="text-4xl font-bold mb-6">Manage Tags</h1>
            <p className="text-muted-foreground mb-8">
                Create and manage tags to organize your items across categories.
            </p>
            <TagManager initialTags={tags} />
        </div>
    )
}
