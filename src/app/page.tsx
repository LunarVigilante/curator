import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { getFeaturedCategories, getUserCategories } from '@/lib/actions/categories';
import UserDashboard from '@/components/dashboard/UserDashboard';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Lock } from 'lucide-react';

export default async function LandingPage() {
  const session = await auth.api.getSession({
    headers: await headers()
  });

  const featuredCategories = await getFeaturedCategories();

  // 1. Logged In View
  if (session) {
    const userCategories = await getUserCategories(session.user.id);
    return (
      <UserDashboard
        userCategories={userCategories as any}
        featuredCategories={featuredCategories as any}
        userName={session.user.name}
      />
    );
  }

  // 2. Marketing / Guest View (Existing Layout with Dynamic Data)
  return (
    <div className="relative min-h-screen w-full overflow-hidden text-white">
      <div className="relative z-10 flex flex-col min-h-screen">

        {/* Hero Section */}
        <section className="relative w-full py-24 md:py-32 lg:py-48 flex flex-col items-center text-center px-4 z-10">
          <div className="max-w-4xl space-y-6">
            <h1 className="font-serif text-6xl md:text-8xl font-bold tracking-tight text-white drop-shadow-2xl">
              Curate Your Culture.
            </h1>
            <p className="mx-auto max-w-2xl text-lg md:text-xl text-zinc-300 leading-relaxed font-light">
              The definitive platform for tracking, ranking, and discovering movies, games, books, and music.
            </p>
            <div className="pt-8">
              <Link href="/login">
                <Button size="lg" className="h-14 px-10 text-lg rounded-full bg-blue-600 hover:bg-blue-500 shadow-[0_0_30px_-5px_options.shadow] shadow-blue-500/50 transition-all hover:scale-105">
                  Enter the Vault
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* Global Collections Teaser */}
        <section className="w-full py-20 px-4 z-10 border-t border-white/5 bg-black/20 backdrop-blur-sm">
          <div className="container mx-auto max-w-7xl">
            <div className="flex flex-col items-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">Featured Collections</h2>
              <p className="text-zinc-400">Explore premium lists curated by the community.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {featuredCategories.length > 0 ? featuredCategories.slice(0, 4).map((collection) => (
                <Link key={collection.id} href={`/categories/${collection.id}`} className="block">
                  <div className="group relative overflow-hidden rounded-xl bg-black/40 backdrop-blur-md border border-white/10 hover:border-white/20 transition-all cursor-pointer hover:-translate-y-1 duration-300 shadow-2xl h-[320px]">
                    {/* Background Image */}
                    <div className="absolute inset-0 z-0">
                      {collection.image ? (
                        <img
                          src={collection.image}
                          alt={collection.name}
                          className="w-full h-full object-cover opacity-60 group-hover:opacity-80 group-hover:scale-110 transition-all duration-700"
                        />
                      ) : (
                        <div className="w-full h-full bg-zinc-800" />
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
                    </div>

                    {/* Content */}
                    <div className="absolute inset-0 z-10 flex flex-col justify-end p-6">
                      <h3 className="text-2xl font-bold text-white mb-2 leading-tight group-hover:text-blue-400 transition-colors drop-shadow-md">
                        {collection.name}
                      </h3>
                      <div className="flex items-center justify-between text-zinc-300 text-sm font-medium">
                        <span className="bg-black/50 px-2 py-1 rounded backdrop-blur-sm border border-white/10">Read more</span>
                        <div className="p-2 rounded-full bg-black/50 backdrop-blur-sm border border-white/10 group-hover:border-blue-500/50 transition-colors">
                          <Lock size={14} className="text-white group-hover:text-blue-400" />
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>
              )) : (
                <div className="col-span-4 text-center text-zinc-500 py-12">
                  Check back soon for featured content.
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="w-full py-8 text-center text-zinc-600 text-sm mt-auto border-t border-white/5 bg-black/60 backdrop-blur-md">
          <p>Invite Only Beta. © 2025 Curator.</p>
        </footer>
      </div>
    </div>
  );
}

