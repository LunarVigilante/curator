import { useState, useTransition } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { updateCategory, deleteCategory } from '@/lib/actions/categories'
import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'

type Category = {
    id: string
    name: string
    description: string | null
    image: string | null
    metadata: string | null
}

export default function EditCategoryDialog({
    category,
    open,
    onOpenChange
}: {
    category: Category
    open: boolean
    onOpenChange: (open: boolean) => void
}) {
    const [isPending, startTransition] = useTransition()
    const router = useRouter()

    const [formData, setFormData] = useState({
        name: category.name,
        description: category.description || '',
        image: category.image || '',
        imageUploadMode: 'url' as 'url' | 'upload'
    })

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        startTransition(async () => {
            await updateCategory(category.id, {
                name: formData.name,
                description: formData.description,
                image: formData.image
            })
            onOpenChange(false)
        })
    }

    const handleDelete = async () => {
        if (confirm('Are you sure you want to delete this category? This action cannot be undone.')) {
            startTransition(async () => {
                await deleteCategory(category.id)
                onOpenChange(false)
                router.push('/')
            })
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[600px]">
                <form onSubmit={handleSubmit}>
                    <DialogHeader>
                        <DialogTitle>Edit Category</DialogTitle>
                        <DialogDescription>
                            Update category details and image.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="name">Name</Label>
                            <Input
                                id="name"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                required
                            />
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="description">Description</Label>
                            <Textarea
                                id="description"
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                rows={3}
                            />
                        </div>

                        <div className="grid gap-2">
                            <Label>Image</Label>
                            <div className="flex gap-2 mb-2">
                                <Button
                                    type="button"
                                    variant={formData.imageUploadMode === 'url' ? 'default' : 'outline'}
                                    size="sm"
                                    onClick={() => setFormData({ ...formData, imageUploadMode: 'url' })}
                                >
                                    URL
                                </Button>
                                <Button
                                    type="button"
                                    variant={formData.imageUploadMode === 'upload' ? 'default' : 'outline'}
                                    size="sm"
                                    onClick={() => setFormData({ ...formData, imageUploadMode: 'upload' })}
                                >
                                    Upload
                                </Button>
                            </div>

                            {formData.imageUploadMode === 'url' ? (
                                <Input
                                    key="url-input"
                                    id="image"
                                    type="url"
                                    placeholder="https://example.com/image.jpg"
                                    value={formData.image}
                                    onChange={(e) => setFormData({ ...formData, image: e.target.value })}
                                />
                            ) : (
                                <Input
                                    key="file-input"
                                    id="imageFile"
                                    type="file"
                                    accept="image/*"
                                    onChange={async (e) => {
                                        const file = e.target.files?.[0]
                                        if (file) {
                                            const fileFormData = new FormData()
                                            fileFormData.append('file', file)
                                            const { uploadImage } = await import('@/lib/actions/upload')
                                            const url = await uploadImage(fileFormData)
                                            if (url) {
                                                setFormData({ ...formData, image: url })
                                            }
                                        }
                                    }}
                                />
                            )}

                            {formData.image && (
                                <div className="mt-2">
                                    <img
                                        src={formData.image}
                                        alt="Preview"
                                        className="h-32 w-full object-cover rounded-md"
                                        onError={(e) => {
                                            e.currentTarget.src = 'https://placehold.co/600x400?text=Invalid+Image'
                                        }}
                                    />
                                </div>
                            )}
                        </div>
                    </div>

                    <DialogFooter className="flex justify-between sm:justify-between">
                        <Button
                            type="button"
                            variant="destructive"
                            onClick={handleDelete}
                            disabled={isPending}
                        >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete Category
                        </Button>
                        <div className="flex gap-2">
                            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                                Cancel
                            </Button>
                            <Button type="submit" disabled={isPending}>
                                {isPending ? 'Saving...' : 'Save Changes'}
                            </Button>
                        </div>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
