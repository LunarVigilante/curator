import { getItem, updateItem, deleteItem } from '@/lib/actions/items'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Separator } from '@/components/ui/separator'
import NumericalRating from '@/components/rating/NumericalRating'
import TierSelector from '@/components/rating/TierSelector'
import { RatingDisplay } from '@/components/rating/RatingDisplay'

export default async function ItemDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    const item = await getItem(id)

    if (!item) {
        notFound()
    }

    const updateItemWithId = updateItem.bind(null, item.id)
    const deleteItemWithId = deleteItem.bind(null, item.id)

    return (
        <div className="container mx-auto py-10 max-w-4xl">
            <div className="mb-6 flex justify-between items-center">
                <Link href="/items">
                    <Button variant="ghost" className="pl-0 hover:pl-0 hover:bg-transparent">
                        &larr; Back to Items
                    </Button>
                </Link>
                <form action={deleteItemWithId}>
                    <Button variant="destructive" type="submit">Delete Item</Button>
                </form>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Edit Form */}
                <Card>
                    <CardHeader>
                        <CardTitle>Edit Item</CardTitle>
                        <CardDescription>Update item details.</CardDescription>
                    </CardHeader>
                    <form action={updateItemWithId}>
                        <CardContent className="space-y-4">
                            <div className="grid gap-2">
                                <Label htmlFor="name">Name</Label>
                                <Input id="name" name="name" defaultValue={item.name} required />
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="category">Category ID</Label>
                                <Input id="category" name="category" defaultValue={item.categoryId || ''} />
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="image">Image URL</Label>
                                <Input id="image" name="image" defaultValue={item.image || ''} />
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="description">Description</Label>
                                <Textarea id="description" name="description" defaultValue={item.description || ''} />
                            </div>
                        </CardContent>
                        <CardFooter>
                            <Button type="submit">Save Changes</Button>
                        </CardFooter>
                    </form>
                </Card>

                {/* Rating Section */}
                <Card>
                    <CardHeader>
                        <CardTitle>Ratings</CardTitle>
                        <CardDescription>Rate this item.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <NumericalRating itemId={item.id} />
                        <Separator />
                        <TierSelector itemId={item.id} />

                        <Separator className="my-4" />
                        <div className="mt-4">
                            <h4 className="font-semibold mb-2">Current Ratings</h4>
                            {item.ratings.length === 0 ? (
                                <p className="text-sm text-muted-foreground">No ratings yet.</p>
                            ) : (
                                <ul className="space-y-2">
                                    {item.ratings.map((r: any) => (
                                        <li key={r.id} className="text-sm flex items-center gap-2">
                                            <RatingDisplay rating={r} variant={r.type === 'NUMERICAL' ? 'bar' : 'badge'} />
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
