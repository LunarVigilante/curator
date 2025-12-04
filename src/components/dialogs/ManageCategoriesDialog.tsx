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
import ImageCropper from '@/components/ImageCropper'

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
    const [imageToCrop, setImageToCrop] = useState<string | null>(null)
    const [newCategory, setNewCategory] = useState({
        name: '',
        description: '',
        image: '',
        color: '#4CAF50',
        imageUploadMode: 'url' as 'url' | 'upload'
    })

    const handleCreate = (e: React.FormEvent) => {
        e.preventDefault()
        startTransition(async () => {
            await createCategory({
                name: newCategory.name,
                description: newCategory.description,
                image: newCategory.image,
                color: newCategory.color
            })
            setNewCategory({ name: '', description: '', image: '', color: '#4CAF50', imageUploadMode: 'url' })
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
                            Add, edit, or remove categories from Curator.
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
                                        <Label>Image</Label>

                                        {newCategory.image ? (
                                            <div className="mt-2 relative group">
                                                <img
                                                    src={newCategory.image}
                                                    alt="Preview"
                                                    className="h-32 w-full object-cover rounded-md"
                                                    onError={(e) => {
                                                        e.currentTarget.src = 'https://placehold.co/600x400?text=Invalid+Image'
                                                    }}
                                                />
                                                <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <Button
                                                        type="button"
                                                        size="sm"
                                                        variant="secondary"
                                                        onClick={async () => {
                                                            const response = await fetch(newCategory.image)
                                                            const blob = await response.blob()
                                                            const reader = new FileReader()
                                                            reader.onload = () => {
                                                                setImageToCrop(reader.result as string)
                                                            }
                                                            reader.readAsDataURL(blob)
                                                        }}
                                                    >
                                                        Adjust
                                                    </Button>
                                                    <Button
                                                        type="button"
                                                        size="sm"
                                                        variant="destructive"
                                                        onClick={() => setNewCategory({ ...newCategory, image: '' })}
                                                    >
                                                        Delete
                                                    </Button>
                                                </div>
                                            </div>
                                        ) : (
                                            <>
                                                <div className="flex gap-2 mb-2">
                                                    <Button
                                                        type="button"
                                                        variant={newCategory.imageUploadMode === 'url' ? 'default' : 'outline'}
                                                        size="sm"
                                                        onClick={() => setNewCategory({ ...newCategory, imageUploadMode: 'url' })}
                                                    >
                                                        URL
                                                    </Button>
                                                    <Button
                                                        type="button"
                                                        variant={newCategory.imageUploadMode === 'upload' ? 'default' : 'outline'}
                                                        size="sm"
                                                        onClick={() => setNewCategory({ ...newCategory, imageUploadMode: 'upload' })}
                                                    >
                                                        Upload
                                                    </Button>
                                                </div>

                                                {newCategory.imageUploadMode === 'url' ? (
                                                    <Input
                                                        key="url-input"
                                                        id="new-image"
                                                        type="url"
                                                        placeholder="https://example.com/image.jpg"
                                                        value={newCategory.image}
                                                        onChange={(e) => setNewCategory({ ...newCategory, image: e.target.value })}
                                                    />
                                                ) : (
                                                    <Input
                                                        key="file-input"
                                                        id="new-imageFile"
                                                        type="file"
                                                        accept="image/*"
                                                        onChange={(e) => {
                                                            const file = e.target.files?.[0]
                                                            if (file) {
                                                                const reader = new FileReader()
                                                                reader.onload = () => {
                                                                    setImageToCrop(reader.result as string)
                                                                }
                                                                reader.readAsDataURL(file)
                                                            }
                                                        }}
                                                    />
                                                )}
                                            </>
                                        )}
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

            {imageToCrop && (
                <ImageCropper
                    imageSrc={imageToCrop}
                    onCropComplete={async (croppedImage) => {
                        const response = await fetch(croppedImage)
                        const blob = await response.blob()
                        const fileFormData = new FormData()
                        fileFormData.append('file', blob, 'cropped-image.jpg')
                        const { uploadImage } = await import('@/lib/actions/upload')
                        const url = await uploadImage(fileFormData)
                        if (url) {
                            setNewCategory(prev => ({ ...prev, image: url }))
                        }
                        setImageToCrop(null)
                    }}
                    onCancel={() => setImageToCrop(null)}
                />
            )}
        </>
    )
}
