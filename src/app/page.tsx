import { getCategories } from '@/lib/actions/categories'
import HomePageClient from './HomePageClient'
import Link from 'next/link'
import { Button } from '@/components/ui/button'


export default async function Home() {
  const categories = await getCategories()
  return (
    <div className="flex flex-col min-h-[calc(100vh-4rem)] grid-background">
      {/* Hero Section */}
      <section className="relative w-full py-20 md:py-32 lg:py-40 xl:py-52 overflow-hidden">
        {/* Hero Glow Effect */}
        <div className="hero-glow" />

        <div className="container relative z-10 mx-auto px-4 md:px-6 max-w-7xl">
          <div className="flex flex-col items-center space-y-6 text-center">
            <div className="space-y-4">
              <h1 className="font-serif text-5xl font-bold tracking-tight sm:text-6xl md:text-7xl lg:text-8xl bg-clip-text text-transparent bg-gradient-to-b from-white via-white to-gray-400">
                Curator
              </h1>
              <p className="mx-auto max-w-[600px] text-gray-400 md:text-lg lg:text-xl leading-relaxed">
                Rank anything and everything. Create tier lists, discover new favorites, and organize your world.
              </p>
            </div>

            {/* Button Group */}
            <div className="flex flex-col sm:flex-row items-center gap-3 pt-4">
              <Button asChild size="lg" className="h-12 px-8">
                <Link href="/items/new">Start Ranking</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Categories Section */}
      <section className="w-full py-16 md:py-24 lg:py-32">
        <div className="container mx-auto px-4 md:px-6 max-w-7xl">
          <div className="flex flex-col items-center justify-center space-y-4 text-center mb-12">
            <div className="space-y-3">
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">Browse Categories</h2>
              <p className="max-w-[600px] text-gray-400 md:text-lg">
                Explore our curated collection of categories or create your own.
              </p>
            </div>
          </div>
          <HomePageClient categories={categories} />
        </div>
      </section>
    </div>
  )
}
