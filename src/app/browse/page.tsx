import { getPublicCategories } from '@/lib/actions/categories';
import Link from 'next/link';
import { Card, CardContent } from "@/components/ui/card";
import { Lock, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default async function BrowsePage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
    const params = await searchParams;
    const query = params.q || '';
    const categories = await getPublicCategories(query);

    return (
        <div className="container mx-auto px-4 py-8 space-y-8">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold font-serif tracking-tight text-white mb-2">Browse Collections</h1>
                    <p className="text-muted-foreground">Discover lists curated by the community.</p>
                </div>

                {/* Search Form */}
                <form action="/browse" method="GET" className="relative w-full md:w-[300px]">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-zinc-400" />
                    <input
                        type="text"
                        name="q"
                        defaultValue={query}
                        placeholder="Search collections..."
                        className="w-full pl-9 h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 text-white placeholder:text-zinc-500 border-white/10 bg-black/20"
                    />
                </form>
            </header>

            {categories.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground border border-dashed border-white/10 rounded-xl">
                    <p>No collections found matching "{query}"</p>
                    {query && (
                        <Link href="/browse" className="mt-4 inline-block text-blue-400 hover:text-blue-300">
                            Clear Search
                        </Link>
                    )}
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {categories.map((cat: any) => (
                        <Link key={cat.id} href={`/categories/${cat.id}`} className="group block">
                            <Card className="border-0 bg-transparent overflow-hidden h-full">
                                <div className="relative aspect-[4/3] rounded-lg overflow-hidden mb-3 border border-white/10 group-hover:border-white/30 transition-colors">
                                    {cat.image ? (
                                        <div
                                            className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-105"
                                            style={{ backgroundImage: `url(${cat.image})` }}
                                        />
                                    ) : (
                                        <div className="absolute inset-0 bg-gradient-to-br from-zinc-800 to-zinc-900" />
                                    )}
                                    <div className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-black/90 via-black/50 to-transparent">
                                        <h3 className="font-semibold text-lg text-white leading-tight mb-1 group-hover:text-blue-400 transition-colors">{cat.name}</h3>
                                        <div className="flex items-center gap-2 text-xs text-zinc-300">
                                            <span>by {cat.owner?.name || 'Unknown'}</span>
                                        </div>
                                    </div>
                                </div>
                            </Card>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
}
