'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { authClient } from '@/lib/auth-client';
import { Button } from '@/components/ui/button';
import { PageBackground } from '@/components/ui/PageBackground';
import { Card, CardContent } from '@/components/ui/card';
import { Lock } from 'lucide-react';
import { toast } from 'sonner';

// Demo Data for Global Collections
const DEMO_COLLECTIONS = [
  {
    id: 'sci-fi',
    title: 'Top 100 Sci-Fi Movies',
    image: 'https://image.tmdb.org/t/p/original/jRXYjXNq0Cs2TcJjLkki24MLp7u.jpg', // Avatar or similar
    items: '100 Items'
  },
  {
    id: 'goty-2024',
    title: '2024 GOTY Contenders',
    image: 'https://image.tmdb.org/t/p/original/a0xQpC8z20J8qg5f2kZ6j8e5u.jpg', // Elden Ring-ish placeholder
    items: '12 Items'
  },
  {
    id: 'essential-reading',
    title: 'Essential Cyberpunk Books',
    image: 'https://images.unsplash.com/photo-1514302240736-b1fee59858eb?q=80&w=2560&auto=format&fit=crop',
    items: '25 Items'
  },
  {
    id: 'best-albums',
    title: 'Rolling Stones Top 500',
    image: 'https://images.unsplash.com/photo-1493225255756-d5829cd91f97?q=80&w=2560&auto=format&fit=crop',
    items: '500 Items'
  }
];

export default function LandingPage() {
  const { data: session } = authClient.useSession();
  const router = useRouter();

  const handleCollectionClick = (collectionId: string) => {
    if (!session) {
      toast.error("Authentication Required", {
        description: "You must be signed in to view this collection.",
        action: {
          label: "Sign In",
          onClick: () => router.push('/login')
        }
      });
      router.push('/login');
      return;
    }
    // If logged in, go to items (or specific category if we had real IDs)
    // For demo, just go to /items
    router.push('/items');
  };

  return (
    <PageBackground>
      <div className="flex flex-col min-h-screen">
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
                <Button
                  size="lg"
                  className="h-14 px-10 text-lg rounded-full bg-blue-600 hover:bg-blue-500 shadow-[0_0_30px_-5px_options.shadow] shadow-blue-500/50 transition-all hover:scale-105"
                >
                  Enter the Vault
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* Global Collections Teaser */}
        <section className="w-full py-20 px-4 z-10 bg-black/20 backdrop-blur-sm border-t border-white/5">
          <div className="container mx-auto max-w-7xl">
            <div className="flex flex-col items-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">Global Collections</h2>
              <p className="text-zinc-400">Explore premium lists curated by the community.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {DEMO_COLLECTIONS.map((collection) => (
                <Card
                  key={collection.id}
                  onClick={() => handleCollectionClick(collection.id)}
                  className="group relative overflow-hidden bg-zinc-900/50 border-white/10 hover:border-white/20 transition-all cursor-pointer hover:-translate-y-1 duration-300"
                >
                  {/* Background Image */}
                  <div className="absolute inset-0 z-0">
                    <img
                      src={collection.image}
                      alt={collection.title}
                      className="w-full h-full object-cover opacity-50 group-hover:opacity-70 group-hover:scale-110 transition-all duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent" />
                  </div>

                  {/* Content */}
                  <CardContent className="relative z-10 h-64 flex flex-col justify-end p-6">
                    <h3 className="text-xl font-bold text-white mb-1 group-hover:text-blue-400 transition-colors">
                      {collection.title}
                    </h3>
                    <div className="flex items-center justify-between text-zinc-400 text-sm">
                      <span>{collection.items}</span>
                      {!session && <Lock size={14} className="text-zinc-500" />}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="w-full py-8 text-center text-zinc-600 text-sm mt-auto border-t border-white/5 bg-black/40 backdrop-blur-md">
          <p>Invite Only Beta. © 2025 Curator.</p>
        </footer>
      </div>
    </PageBackground>
  );
}
