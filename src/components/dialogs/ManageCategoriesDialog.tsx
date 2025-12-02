'use client'

import { useState, useTransition } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { createCategory, deleteCategory } from '@/lib/actions/categories'
import { Trash2, Plus } from 'lucide-react'
import EditCategoryDialog from './EditCategoryDialog'

type Category = {
    id: string
    name: string
    description: string | null
    image: string | null
    color: string | null
    metadata: string | null
}

export default function ManageCategoriesDialog({
    categories,
    open,
    onOpenChange
}: {
    categories: Category[]
    open: boolean
    onOpenChange: (open: boolean) => void
}) {
    const [isPending, startTransition] = useTransition()
    const [isAdding, setIsAdding] = useState(false)
    const [editingCategory, setEditingCategory] = useState<Category | null>(null)
    const [newCategory, setNewCategory] = useState({
        name: '',
        description: '',
        image: '',
        color: '#4CAF50'
    })

    const handleCreate = (e: React.FormEvent) => {
        e.preventDefault()
        startTransition(async () => {
            await createCategory(newCategory)
            setNewCategory({ name: '', description: '', image: '', color: '#4CAF50' })
            setIsAdding(false)
        })
    }

    const handleDelete = (id: string, name: string) => {
        if (!confirm(`Are you sure you want to delete "${name}"? This will also delete all items in this category.`)) {
            return
        }
        startTransition(async () => {
            await deleteCategory(id)
        })
    }

    return (
        <>
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Manage Categories</DialogTitle>
                        <DialogDescription>
                            Add, edit, or remove categories from your ranking system.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="py-4">
                        {/* Add Category Button */}
                        {!isAdding && (
                            <Button onClick={() => setIsAdding(true)} className="w-full mb-4">
                                <Plus className="h-4 w-4 mr-2" />
                                Add New Category
                            </Button>
                        )}

                        {/* Add Category Form */}
                        {isAdding && (
                            <form onSubmit={handleCreate} className="border rounded-lg p-4 mb-4 bg-muted/50">
                                <h3 className="font-semibold mb-3">New Category</h3>
                                <div className="grid gap-3">
                                    <div>
                                        <Label htmlFor="new-name">Name *</Label>
                                        <Input
                                            id="new-name"
                                            value={newCategory.name}
                                            onChange={(e) => setNewCategory({ ...newCategory, name: e.target.value })}
                                            required
                                        />
                                    </div>
                                    <div>
                                        <Label htmlFor="new-description">Description</Label>
                                        <Textarea
                                            id="new-description"
                                            value={newCategory.description}
                                            onChange={(e) => setNewCategory({ ...newCategory, description: e.target.value })}
                                            rows={2}
                                        />
                                    </div>
                                    <div>
                                        <Label htmlFor="new-color">Color</Label>
                                        <div className="flex gap-2">
                                            <Input
                                                id="new-color"
                                                type="color"
                                                value={newCategory.color}
                                                onChange={(e) => setNewCategory({ ...newCategory, color: e.target.value })}
                                                className="w-20 h-10"
                                            />
                                            <Input
                                                value={newCategory.color}
                                                onChange={(e) => setNewCategory({ ...newCategory, color: e.target.value })}
                                                placeholder="#4CAF50"
                                            />
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <Button type="submit" disabled={isPending}>
                                            {isPending ? 'Creating...' : 'Create'}
                                        </Button>
                                        <Button type="button" variant="outline" onClick={() => setIsAdding(false)}>
                                            Cancel
                                        </Button>
                                    </div>
                                </div>
                            </form>
                        )}

                        {/* Category List */}
                        <div className="space-y-2">
                            <h3 className="font-semibold text-sm text-muted-foreground mb-2">Existing Categories</h3>
                            {categories.map((category) => (
                                <div
                                    key={category.id}
                                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50"
                                >
                                    <div className="flex items-center gap-3">
                                        <div
                                            className="w-10 h-10 rounded flex items-center justify-center text-white font-bold"
                                            style={{ backgroundColor: category.color || '#999' }}
                                        >
                                            {category.name[0]}
                                        </div>
                                        <div>
                                            <div className="font-medium">{category.name}</div>
                                            {category.description && (
                                                <div className="text-sm text-muted-foreground">{category.description}</div>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => setEditingCategory(category)}
                                        >
                                            Edit
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="destructive"
                                            onClick={() => handleDelete(category.id, category.name)}
                                            disabled={isPending}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => onOpenChange(false)}>
                            Close
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Edit Category Dialog */}
            {editingCategory && (
                <EditCategoryDialog
                    category={editingCategory}
                    open={!!editingCategory}
                    onOpenChange={(open) => !open && setEditingCategory(null)}
                />
            )}
        </>
    )
}
