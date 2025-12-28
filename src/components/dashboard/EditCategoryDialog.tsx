'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { updateCategory } from '@/lib/actions/categories';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface EditCategoryDialogProps {
    isOpen: boolean;
    onClose: () => void;
    category: {
        id: string;
        name: string;
        description: string | null;
        image: string | null;
        // add other fields if needed for full update
    };
}

export default function EditCategoryDialog({ isOpen, onClose, category }: EditCategoryDialogProps) {
    if (!category) return null;

    const [name, setName] = useState(category.name);
    const [description, setDescription] = useState(category.description || '');
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            await updateCategory(category.id, {
                name,
                description,
                image: category.image || '', // preserving existing image for now
                // We're doing a partial visual update, so we need to be careful if updateCategory expects full object.
                // Checking action signature: it takes partial but image is required in the type def?
                // Let's check categories.ts: data: { name, description, image, ... }
                // So image IS required. We pass current one back.
            });
            toast.success("Category updated");
            onClose();
        } catch (error) {
            toast.error("Failed to update category");
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[425px] bg-zinc-900 border-white/10 text-white">
                <DialogHeader>
                    <DialogTitle>Edit Collection</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 pt-4">
                    <div className="space-y-2">
                        <Label htmlFor="name" className="text-zinc-400">Name</Label>
                        <Input
                            id="name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="bg-black/20 border-white/10 text-white focus-visible:ring-blue-500/50"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="description" className="text-zinc-400">Description</Label>
                        <Textarea
                            id="description"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            className="bg-black/20 border-white/10 text-white focus-visible:ring-blue-500/50 min-h-[100px]"
                        />
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="ghost" onClick={onClose} className="hover:bg-white/5 hover:text-white">
                            Cancel
                        </Button>
                        <Button type="submit" disabled={isLoading} className="bg-blue-600 hover:bg-blue-500 text-white">
                            {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                            Save Changes
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
