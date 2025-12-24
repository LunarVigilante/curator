'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search, Loader2, Star, X, Plus } from 'lucide-react';
import { getAllCategoriesWithOwners, toggleCategoryFeature } from '@/lib/actions/categories';

interface CategoryWithOwner {
    id: string;
    name: string;
    isFeatured: boolean;
    isPublic: boolean;
    owner: {
        name: string;
        email: string;
    } | null;
}

export default function FeaturedContent() {
    const [categories, setCategories] = useState<CategoryWithOwner[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [isUpdating, setIsUpdating] = useState<string | null>(null);

    useEffect(() => {
        loadCategories();
    }, []);

    const loadCategories = async () => {
        try {
            const data = await getAllCategoriesWithOwners();
            setCategories(data as any); // Type assertion needed due to relational query return type
        } catch (error) {
            toast.error("Failed to load categories");
        } finally {
            setIsLoading(false);
        }
    };

    const handleToggleFeature = async (id: string, currentStatus: boolean) => {
        setIsUpdating(id);
        try {
            await toggleCategoryFeature(id, !currentStatus);
            setCategories(prev => prev.map(cat =>
                cat.id === id ? { ...cat, isFeatured: !currentStatus } : cat
            ));
            toast.success(currentStatus ? "Removed from featured" : "Added to featured");
        } catch (error) {
            toast.error("Failed to update featured status");
        } finally {
            setIsUpdating(null);
        }
    };

    const featuredCategories = categories.filter(c => c.isFeatured);
    const availableCategories = categories.filter(c =>
        !c.isFeatured &&
        c.isPublic &&
        c.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (isLoading) {
        return (
            <div className="flex justify-center p-8">
                <Loader2 className="h-8 w-8 animate-spin text-zinc-400" />
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left Side: Current Featured */}
            <Card className="border-white/10 bg-black/20 backdrop-blur-sm h-fit">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Star className="h-5 w-5 text-yellow-500" fill="currentColor" />
                        Featured on Homepage
                    </CardTitle>
                    <CardDescription>
                        These categories appear in the 'Featured' section.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                    {featuredCategories.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground bg-white/5 rounded-lg border border-dashed border-white/10">
                            No featured categories
                        </div>
                    ) : (
                        featuredCategories.map(cat => (
                            <div key={cat.id} className="flex items-center justify-between p-3 rounded-lg bg-zinc-900/50 border border-white/10 group">
                                <div>
                                    <div className="font-medium text-white flex items-center gap-2">
                                        {cat.name}
                                        {cat.isPublic && <Badge variant="secondary" className="text-[10px] h-4 bg-green-500/20 text-green-400 border-green-500/30">Live</Badge>}
                                    </div>
                                    <div className="text-xs text-zinc-400">
                                        by {cat.owner?.name || 'Unknown'}
                                    </div>
                                </div>
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    className="text-zinc-400 hover:text-red-400 hover:bg-red-500/10"
                                    disabled={isUpdating === cat.id}
                                    onClick={() => handleToggleFeature(cat.id, true)}
                                >
                                    {isUpdating === cat.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
                                </Button>
                            </div>
                        ))
                    )}
                </CardContent>
            </Card>

            {/* Right Side: Search & Add */}
            <Card className="border-white/10 bg-black/20 backdrop-blur-sm h-fit">
                <CardHeader>
                    <CardTitle>Add Content</CardTitle>
                    <CardDescription>
                        Search public categories to feature.
                    </CardDescription>
                    <div className="relative mt-2">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-zinc-400" />
                        <Input
                            placeholder="Search by name..."
                            className="pl-9 bg-zinc-900/50 border-white/10"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </CardHeader>
                <CardContent className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
                    {searchQuery && availableCategories.length === 0 ? (
                        <div className="text-center py-4 text-muted-foreground">
                            No matching public categories found
                        </div>
                    ) : availableCategories.length === 0 && !searchQuery ? (
                        <div className="text-center py-4 text-muted-foreground">
                            Type to search public categories...
                        </div>
                    ) : (
                        availableCategories.map(cat => (
                            <div key={cat.id} className="flex items-center justify-between p-3 rounded-lg bg-zinc-900/30 border border-white/5 hover:border-white/20 transition-colors">
                                <div>
                                    <div className="font-medium text-zinc-200">
                                        {cat.name}
                                    </div>
                                    <div className="text-xs text-zinc-500">
                                        by {cat.owner?.name || 'Unknown'}
                                    </div>
                                </div>
                                <Button
                                    size="sm"
                                    variant="secondary"
                                    className="gap-1 h-8"
                                    disabled={isUpdating === cat.id}
                                    onClick={() => handleToggleFeature(cat.id, false)}
                                >
                                    {isUpdating === cat.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                                    Add
                                </Button>
                            </div>
                        ))
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
