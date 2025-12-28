'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Settings, GripVertical, X, Lock, Pencil } from 'lucide-react';
import ActivityFeed from './ActivityFeed';
import ChallengeCard from './ChallengeCard';
import { Button } from '@/components/ui/button';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, rectSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { updateCategoryOrder, reorderCategories } from '@/lib/actions/categories';
import EditCategoryDialog from '@/components/dialogs/EditCategoryDialog';
import CreateCategoryDialog from '@/components/dialogs/CreateCategoryDialog';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

interface Category {
    id: string;
    name: string;
    image: string | null;
    description: string | null;
    metadata?: string | null;
    isPublic?: boolean;
    itemCount?: number;
}

interface UserDashboardProps {
    userCategories: Category[];
    featuredCategories: Category[];
    followedUsers?: any[];
    userName: string;
    currentChallenge?: any;
    activities?: any[];
}

export default function UserDashboard({
    userCategories,
    featuredCategories,
    followedUsers = [],
    userName,
    currentChallenge,
    activities = []
}: UserDashboardProps) {
    const [isEditing, setIsEditing] = useState(false);
    const [categories, setCategories] = useState(userCategories);
    const [editingCategory, setEditingCategory] = useState<Category | null>(null);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [isMounted, setIsMounted] = useState(false);
    const router = useRouter();

    // Fix hydration mismatch - only render DnD after mount
    useEffect(() => {
        setIsMounted(true);
    }, []);

    // Sync categories state when props change (after server refresh)
    useEffect(() => {
        setCategories(userCategories);
    }, [userCategories]);

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event;

        if (over && active.id !== over.id) {
            setCategories((items) => {
                const oldIndex = items.findIndex((item) => item.id === active.id);
                const newIndex = items.findIndex((item) => item.id === over.id);
                const newItems = arrayMove(items, oldIndex, newIndex);

                // Persist order
                const updates = newItems.map((item, index) => ({
                    id: item.id,
                    sortOrder: index
                }));

                reorderCategories(updates).catch(() => toast.error("Failed to save order"));

                return newItems;
            });
        }
    };

    return (
        <div className="container mx-auto px-4 py-8 space-y-12">

            {editingCategory && (
                <EditCategoryDialog
                    category={{
                        ...editingCategory,
                        metadata: editingCategory.metadata || null,
                        isPublic: editingCategory.isPublic ?? true
                    }}
                    open={!!editingCategory}
                    onOpenChange={(open) => !open && setEditingCategory(null)}
                    onSuccess={() => {
                        setEditingCategory(null);
                        router.refresh();
                    }}
                />
            )}

            <CreateCategoryDialog
                open={isCreateModalOpen}
                onOpenChange={setIsCreateModalOpen}
            />

            {/* Header */}
            <header className="flex items-end justify-between">
                <div className="space-y-2">
                    <h1 className="text-3xl font-bold font-serif tracking-tight">
                        Welcome back, {userName}
                    </h1>
                    <p className="text-muted-foreground">
                        Continue curating your collections or discover something new.
                    </p>
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    className={`gap-2 border-white/10 ${isEditing ? 'bg-white/10 text-white border-white/20' : 'text-zinc-400 hover:text-white'}`}
                    onClick={() => setIsEditing(!isEditing)}
                >
                    <Settings className="h-4 w-4" />
                    {isEditing ? 'Done' : 'Customize'}
                </Button>
            </header>

            {currentChallenge && (
                <ChallengeCard challenge={currentChallenge} />
            )}

            <div className="flex flex-col lg:flex-row gap-8">
                <div className="flex-1 space-y-12">
                    {/* My Collections */}
                    <section className="space-y-6">
                        <div className="flex items-center justify-between border-b border-white/5 pb-4">
                            <div className="flex items-center gap-3">
                                <h2 className="text-xl font-semibold">My Collections</h2>
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    className="h-7 text-xs gap-1 bg-white/10 hover:bg-white/20 text-white border border-white/5"
                                    onClick={() => setIsCreateModalOpen(true)}
                                >
                                    <Plus className="h-3 w-3" /> New
                                </Button>
                            </div>
                            <span className="text-xs text-zinc-500 font-mono uppercase tracking-wider">{userCategories.length} Collections</span>
                        </div>

                        {isMounted ? (
                            <DndContext
                                sensors={sensors}
                                collisionDetection={closestCenter}
                                onDragEnd={handleDragEnd}
                            >
                                <SortableContext
                                    items={categories.map(c => c.id)}
                                    strategy={rectSortingStrategy}
                                >
                                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                                        {/* User Categories */}
                                        {categories.map(cat => (
                                            <SortableCategoryCard
                                                key={cat.id}
                                                category={cat}
                                                isEditing={isEditing}
                                                onEdit={() => setEditingCategory(cat)}
                                            />
                                        ))}
                                    </div>
                                </SortableContext>
                            </DndContext>
                        ) : (
                            // Static fallback for SSR - prevents hydration mismatch
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                                {categories.map(cat => (
                                    <div key={cat.id} className="group relative h-[200px]">
                                        <Link href={`/categories/${cat.id}`} className="block h-full relative overflow-hidden rounded-xl bg-zinc-900 border border-white/5">
                                            <div className="absolute inset-0 flex items-center justify-center overflow-hidden pointer-events-none opacity-10 select-none">
                                                <span className="text-6xl font-black text-white/50 transform -rotate-12 scale-150 whitespace-nowrap uppercase tracking-tighter">
                                                    {cat.name}
                                                </span>
                                            </div>
                                            {cat.image && (
                                                <div
                                                    className="absolute inset-0 bg-cover bg-center opacity-40"
                                                    style={{ backgroundImage: `url(${cat.image})` }}
                                                />
                                            )}
                                            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/40 to-transparent p-5 pt-16 flex flex-col justify-end h-full">
                                                <h3 className="text-xl font-bold text-white leading-tight mb-1">{cat.name}</h3>
                                                <p className="text-xs text-zinc-400 font-medium mb-1">{cat.itemCount || 0} items</p>
                                            </div>
                                        </Link>
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>

                    {/* Recommended / Featured */}
                    {featuredCategories.length > 0 && (
                        <section className="space-y-4 pt-8 border-t border-white/10">
                            <div className="flex items-center gap-2">
                                <h2 className="text-xl font-semibold">Recommended for You</h2>
                                <span className="px-2 py-0.5 rounded-full bg-yellow-500/10 text-yellow-500 text-[10px] font-bold border border-yellow-500/20 uppercase tracking-wide">
                                    Featured
                                </span>
                            </div>

                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                                {featuredCategories.map(cat => (
                                    <Link key={cat.id} href={`/categories/${cat.id}`} className="block group">
                                        <Card className="border-0 bg-transparent overflow-hidden">
                                            <div className="relative aspect-[4/3] rounded-lg overflow-hidden mb-3">
                                                {cat.image ? (
                                                    <div
                                                        className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-105"
                                                        style={{ backgroundImage: `url(${cat.image})` }}
                                                    />
                                                ) : (
                                                    <div className="absolute inset-0 bg-zinc-800" />
                                                )}
                                                <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors" />
                                            </div>
                                            <CardContent className="p-0">
                                                <h3 className="font-semibold text-lg leading-none mb-1 group-hover:text-blue-400 transition-colors">{cat.name}</h3>
                                                <p className="text-sm text-muted-foreground line-clamp-2">{cat.description || "Discover this curated collection."}</p>
                                            </CardContent>
                                        </Card>
                                    </Link>
                                ))}
                            </div>
                        </section>
                    )}
                </div>



                {/* Sidebar - Followed Curators & Activity */}
                <aside className={`lg:w-72 flex-shrink-0 space-y-8 ${activities.length === 0 && followedUsers.length === 0 ? 'hidden lg:block lg:invisible' : ''}`}>

                    {/* Activity Feed - Only show if there are activities */}
                    {activities.length > 0 && (
                        <section className="p-6 rounded-2xl bg-black/20 border border-white/5 backdrop-blur-sm">
                            <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wider mb-4">Activity Feed</h3>
                            <ActivityFeed activities={activities} />
                        </section>
                    )}

                    {followedUsers.length > 0 && (
                        <section className="p-6 rounded-2xl bg-black/20 border border-white/5 backdrop-blur-sm">
                            <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wider mb-4">Curators you follow</h3>
                            <div className="space-y-3">
                                {followedUsers.map((user: any) => (
                                    <Link key={user.id} href={`/u/${user.id}`} className="flex items-center gap-3 group hover:bg-white/5 p-2 rounded-lg transition-colors -mx-2">
                                        <div className="h-10 w-10 rounded-full bg-zinc-800 border-2 border-transparent group-hover:border-blue-500/50 transition-colors overflow-hidden">
                                            {user.image ? (
                                                <img src={user.image} alt={user.name} className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-xs font-bold text-zinc-500">
                                                    {user.name[0]}
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-medium text-zinc-200 truncate group-hover:text-white transition-colors">
                                                {user.name}
                                            </p>
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        </section>
                    )}
                </aside>
            </div>
        </div>
    );
}

function SortableCategoryCard({ category, isEditing, onEdit }: { category: Category, isEditing: boolean, onEdit: () => void }) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id: category.id, disabled: !isEditing });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        zIndex: isDragging ? 50 : 'auto',
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={`group relative h-[200px] ${isEditing ? 'animate-shake' : ''}`}
            {...attributes}
            {...(isEditing ? listeners : {})}
        >
            {isEditing && (
                <div className="absolute -top-2 -right-2 z-50 flex gap-1 pointer-events-auto">
                    <button className="h-6 w-6 rounded-full bg-red-500 text-white flex items-center justify-center shadow-lg hover:bg-red-600 transition-colors">
                        <X className="h-3 w-3" />
                    </button>
                </div>
            )}

            {!isEditing && (
                <div className="absolute top-2 right-2 z-30 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                        onClick={(e) => {
                            e.preventDefault();
                            onEdit();
                        }}
                        className="h-8 w-8 rounded-full bg-black/50 backdrop-blur-md border border-white/10 text-white flex items-center justify-center hover:bg-black/80 hover:text-blue-400 transition-all"
                    >
                        <Pencil className="h-3.5 w-3.5" />
                    </button>
                </div>
            )}

            <Link href={`/categories/${category.id}`} className={`block h-full relative overflow-hidden rounded-xl bg-zinc-900 border border-white/5 transition-all hover:border-white/20 hover:shadow-xl ${isEditing ? 'pointer-events-none' : 'hover:-translate-y-1'}`}>

                {/* Background Typography */}
                <div className="absolute inset-0 flex items-center justify-center overflow-hidden pointer-events-none opacity-10 select-none">
                    <span className="text-6xl font-black text-white/50 transform -rotate-12 scale-150 whitespace-nowrap uppercase tracking-tighter">
                        {category.name}
                    </span>
                </div>

                {category.image ? (
                    <div
                        className="absolute inset-0 bg-cover bg-center transition-transform duration-500 group-hover:scale-110 opacity-40 group-hover:opacity-50"
                        style={{ backgroundImage: `url(${category.image})` }}
                    />
                ) : (
                    <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 to-purple-500/10" />
                )}

                {/* Reduced Gradient Opacity per user request: via-black/40 instead of 80 */}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/40 to-transparent p-5 pt-16 flex flex-col justify-end h-full">
                    <h3 className="text-xl font-bold text-white leading-tight mb-1">{category.name}</h3>
                    <p className="text-xs text-zinc-400 font-medium mb-1">{category.itemCount || 0} items</p>
                    {category.description && (
                        <p className="text-[10px] text-zinc-500 line-clamp-1 opacity-0 group-hover:opacity-100 transition-opacity translate-y-2 group-hover:translate-y-0 duration-300">
                            {category.description}
                        </p>
                    )}
                </div>

                {isEditing && (
                    <div className="absolute inset-0 bg-black/20 backdrop-blur-[1px] flex items-center justify-center z-40 cursor-move border-2 border-dashed border-white/20 rounded-xl">
                        <GripVertical className="bg-black/50 p-1 rounded h-8 w-8 text-white" />
                    </div>
                )}
            </Link>
        </div>
    );
}
