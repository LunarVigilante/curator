'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Card, CardContent } from "@/components/ui/card";
import { Plus } from 'lucide-react';

interface Category {
    id: string;
    name: string;
    image: string | null;
    description: string | null;
}

interface UserDashboardProps {
    userCategories: Category[];
    featuredCategories: Category[];
    userName: string;
}

export default function UserDashboard({ userCategories, featuredCategories, userName }: UserDashboardProps) {
    return (
        <div className="container mx-auto px-4 py-8 space-y-12">

            {/* Header */}
            <header className="space-y-2">
                <h1 className="text-3xl font-bold font-serif tracking-tight">
                    Welcome back, {userName}
                </h1>
                <p className="text-muted-foreground">
                    Continue curating your collections or discover something new.
                </p>
            </header>

            {/* My Collections */}
            <section className="space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-xl font-semibold">My Collections</h2>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    {/* Create New Card */}
                    <Link href="/categories/new" className="group h-full">
                        <div className="h-[200px] border-2 border-dashed border-white/10 rounded-xl flex flex-col items-center justify-center gap-3 transition-all hover:bg-white/5 hover:border-white/20 hover:scale-[1.02]">
                            <div className="h-10 w-10 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-white/10">
                                <Plus className="h-5 w-5 text-white/70" />
                            </div>
                            <span className="font-medium text-sm text-white/70">Create New Collection</span>
                        </div>
                    </Link>

                    {/* User Categories */}
                    {userCategories.map(cat => (
                        <Link key={cat.id} href={`/categories/${cat.id}`} className="group relative block overflow-hidden rounded-xl bg-muted/40 transition-all hover:scale-[1.02] hover:shadow-lg h-[200px]">
                            {cat.image ? (
                                <div
                                    className="absolute inset-0 bg-cover bg-center transition-transform duration-500 group-hover:scale-110 opacity-70"
                                    style={{ backgroundImage: `url(${cat.image})` }}
                                />
                            ) : (
                                <div className="absolute inset-0 bg-gradient-to-br from-indigo-900/50 to-purple-900/50" />
                            )}
                            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent p-4 pt-12">
                                <h3 className="text-lg font-bold text-white line-clamp-1">{cat.name}</h3>
                                {cat.description && (
                                    <p className="text-xs text-zinc-300 line-clamp-1">{cat.description}</p>
                                )}
                            </div>
                        </Link>
                    ))}
                </div>
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
    );
}
