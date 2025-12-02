import { createItem } from '@/lib/actions/items'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import Link from 'next/link'

export default function NewItemPage() {
    return (
        <div className="container mx-auto py-10 max-w-2xl">
            <div className="mb-6">
                <Link href="/items">
                    <Button variant="ghost" className="pl-0 hover:pl-0 hover:bg-transparent">
                        &larr; Back to Items
                    </Button>
                </Link>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Create New Item</CardTitle>
                    <CardDescription>
                        Add a new item to your ranking system.
                    </CardDescription>
                </CardHeader>
                <form action={createItem}>
                    <CardContent className="space-y-4">
                        <div className="grid gap-2">
                            <Label htmlFor="name">Name</Label>
                            <Input id="name" name="name" required placeholder="Item name" />
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="category">Category</Label>
                            <Input id="category" name="category" placeholder="e.g., Movie, Game, Book" />
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="image">Image URL</Label>
                            <Input id="image" name="image" placeholder="https://..." />
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="description">Description</Label>
                            <Textarea id="description" name="description" placeholder="Brief description..." />
                        </div>
                    </CardContent>
                    <CardFooter className="flex justify-between">
                        <Link href="/items">
                            <Button variant="outline">Cancel</Button>
                        </Link>
                        <Button type="submit">Create Item</Button>
                    </CardFooter>
                </form>
            </Card>
        </div>
    )
}
