import { getCategories } from '@/lib/actions/categories'
import HomePageClient from './HomePageClient'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { AnalyzeButton } from '@/components/analysis/AnalyzeButton'

export default async function Home() {
  const categories = await getCategories()
  return (
    <div className="flex flex-col min-h-[calc(100vh-4rem)]">
      {/* Hero Section */}
      <section className="w-full py-12 md:py-24 lg:py-32 xl:py-48 bg-gradient-to-b from-background to-muted/20">
        <div className="container mx-auto px-4 md:px-6 max-w-7xl">
          <div className="flex flex-col items-center space-y-4 text-center">
            <div className="space-y-2">
              <h1 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl lg:text-6xl/none bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-500">
                Curator
              </h1>
              <p className="mx-auto max-w-[700px] text-gray-500 md:text-xl dark:text-gray-400">
                Rank anything and everything. Create tier lists, discover new favorites, and organize your world.
              </p>
            </div>
            <div className="space-x-4">
              <Button asChild size="lg" className="h-11 px-8">
                <Link href="/items/new">Start Ranking</Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="h-11 px-8">
                <Link href="/tags">Manage Tags</Link>
              </Button>
              <AnalyzeButton />
            </div>
          </div>
        </div>
      </section>

      {/* Categories Section */}
      <section className="w-full py-12 md:py-24 lg:py-32 bg-background">
        <div className="container mx-auto px-4 md:px-6 max-w-7xl">
          <div className="flex flex-col items-center justify-center space-y-4 text-center mb-12">
            <div className="space-y-2">
              <h2 className="text-3xl font-bold tracking-tighter sm:text-5xl">Browse Categories</h2>
              <p className="max-w-[900px] text-gray-500 md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed dark:text-gray-400">
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
