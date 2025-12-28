'use client'

import { useState, useTransition } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { createCategory } from '@/lib/actions/categories'
import { useRouter } from 'next/navigation'
import { Checkbox } from '@/components/ui/checkbox'
import ImageCropper from '@/components/ImageCropper'

export default function CreateCategoryDialog({
    open,
    onOpenChange,
    onSuccess
}: {
    open: boolean
    onOpenChange: (open: boolean) => void
    onSuccess?: () => void
}) {
    const [isPending, startTransition] = useTransition()
    const router = useRouter()
    const [imageToCrop, setImageToCrop] = useState<string | null>(null)

    const initialFormData = {
        name: '',
        description: '',
        image: '',
        isPublic: true,
        imageUploadMode: 'url' as 'url' | 'upload'
    }

    const [formData, setFormData] = useState(initialFormData)

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        startTransition(async () => {
            const result = await createCategory({
                name: formData.name,
                description: formData.description,
                image: formData.image,
                color: '',
                isPublic: formData.isPublic
            })

            setFormData(initialFormData)
            onOpenChange(false)

            if (onSuccess) {
                onSuccess()
            }

            // Navigate to the new category
            if (result?.id) {
                router.push(`/categories/${result.id}`)
            } else {
                router.refresh()
            }
        })
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[600px]">
                <form onSubmit={handleSubmit}>
                    <DialogHeader>
                        <DialogTitle>Create New Collection</DialogTitle>
                        <DialogDescription>
                            Create a new collection to organize and rank your items.
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
                                placeholder="e.g., My Favorite Movies"
                                className="h-10"
                            />
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="description">Description</Label>
                            <Textarea
                                id="description"
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                rows={3}
                                placeholder="What will you rank in this collection?"
                            />
                        </div>

                        <div className="flex items-start space-x-3 py-2">
                            <Checkbox
                                id="create-public"
                                checked={formData.isPublic}
                                onCheckedChange={(checked) => setFormData({ ...formData, isPublic: checked as boolean })}
                                className="mt-1"
                            />
                            <div className="grid gap-1.5 leading-none">
                                <Label htmlFor="create-public" className="text-sm font-medium cursor-pointer">
                                    Public Collection
                                </Label>
                                <p className="text-xs text-muted-foreground">
                                    Visible to everyone on your profile
                                </p>
                            </div>
                        </div>

                        <div className="grid gap-2">
                            <Label>Cover Image (Optional)</Label>

                            {formData.image ? (
                                <div className="mt-2 relative group aspect-video rounded-xl overflow-hidden border border-white/10 bg-white/[0.03]">
                                    <img
                                        src={formData.image}
                                        alt="Preview"
                                        className="w-full h-full object-cover transition-transform group-hover:scale-105"
                                        onError={(e) => {
                                            e.currentTarget.src = 'https://placehold.co/1280x720?text=Invalid+Image'
                                        }}
                                    />
                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                        <Button
                                            type="button"
                                            size="sm"
                                            variant="secondary"
                                            className="h-8 shadow-lg"
                                            onClick={async () => {
                                                const response = await fetch(formData.image)
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
                                            className="h-8 shadow-lg"
                                            onClick={() => setFormData({ ...formData, image: '' })}
                                        >
                                            Remove
                                        </Button>
                                    </div>
                                </div>
                            ) : (
                                <>
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
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={isPending || !formData.name}>
                            {isPending ? 'Creating...' : 'Create Collection'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>

            {imageToCrop && (
                <ImageCropper
                    imageSrc={imageToCrop}
                    aspectRatio={16 / 9}
                    onCropComplete={async (croppedImage) => {
                        // Convert base64 to blob
                        const response = await fetch(croppedImage)
                        const blob = await response.blob()

                        // Upload the cropped image
                        const fileFormData = new FormData()
                        fileFormData.append('file', blob, 'cropped-image.jpg')
                        const { uploadImage } = await import('@/lib/actions/upload')
                        const url = await uploadImage(fileFormData)

                        if (url) {
                            setFormData({ ...formData, image: url })
                        }
                        setImageToCrop(null)
                    }}
                    onCancel={() => setImageToCrop(null)}
                />
            )}
        </Dialog>
    )
}
