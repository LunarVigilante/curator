import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Card } from '@/components/ui/card'
import { ProfileHeader } from '@/components/profile/ProfileHeader'
import { TopPicksDialog } from '@/components/profile/TopPicksDialog'
import { TopPicksSection } from '@/components/profile/TopPicksSection'
import { ProfileEditor } from '@/components/profile/ProfileEditor'
import type { PublicProfile } from '@/lib/actions/profile'
import { useRouter } from 'next/navigation'
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"
import { Trophy, Hexagon } from 'lucide-react'

interface Collection {
    id: string
    name: string
    image: string | null
    description: string | null
    itemCount: number
}

interface ProfileViewProps {
    profile: PublicProfile
    collections: Collection[]
    challenges: any[] // TODO: Define strict type
    isOwner: boolean
}

export function ProfileView({ profile, collections, challenges = [], isOwner }: ProfileViewProps) {
    const [showEditor, setShowEditor] = useState(false)
    const [showPickDialog, setShowPickDialog] = useState(false)
    const router = useRouter()

    const handleEditSuccess = () => {
        router.refresh()
    }

    const activeChallenges = challenges.filter(c => c.status === 'ACTIVE');
    const completedChallenges = challenges.filter(c => c.status === 'COMPLETED');

    // Use cover image or first collection image for dynamic background
    const backgroundImage = profile.coverImage || collections[0]?.image

    return (
        <>
            {/* Dynamic Background Layer */}
            {backgroundImage && (
                <div className="fixed inset-0 -z-10">
                    <Image
                        src={backgroundImage}
                        alt=""
                        fill
                        className="object-cover blur-2xl opacity-30 scale-110"
                        priority
                    />
                    <div className="absolute inset-0 bg-black/50" />
                    <div className="absolute bottom-0 inset-x-0 h-[50%] bg-gradient-to-t from-zinc-950 to-transparent" />
                </div>
            )}

            <div className="min-h-screen text-white relative z-10">
                <div className="max-w-4xl mx-auto p-6 space-y-6">
                    <Card className="bg-zinc-900/50 border-white/10 overflow-hidden backdrop-blur-sm">
                        <ProfileHeader
                            profile={profile}
                            isOwner={isOwner}
                            onEditClick={() => setShowEditor(true)}
                        />
                    </Card>

                    <TopPicksSection
                        picks={profile.topPicks}
                        isOwner={isOwner}
                        onAddClick={() => setShowPickDialog(true)}
                    />

                    <Tabs defaultValue="collections" className="w-full">
                        <TabsList className="bg-zinc-900/50 border border-white/10 p-1 mb-6">
                            <TabsTrigger value="collections" className="flex-1">Collections</TabsTrigger>
                            <TabsTrigger value="challenges" className="flex-1">Challenges</TabsTrigger>
                            <TabsTrigger value="likes" className="flex-1">Likes</TabsTrigger>
                        </TabsList>

                        <TabsContent value="collections">
                            <Card className="bg-zinc-900/50 border-white/10 p-6 backdrop-blur-sm">
                                <h2 className="text-lg font-semibold text-zinc-100 mb-4">Public Collections</h2>
                                {collections.length > 0 ? (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {collections.map((collection) => (
                                            <Link key={collection.id} href={`/categories/${collection.id}`}>
                                                <div className="group relative rounded-lg overflow-hidden border border-white/10 bg-zinc-800/50 hover:border-white/20 transition-all cursor-pointer">
                                                    <div className="aspect-video relative bg-gradient-to-br from-purple-600/20 to-blue-600/20">
                                                        {collection.image && (
                                                            <Image
                                                                src={collection.image}
                                                                alt={collection.name}
                                                                fill
                                                                className="object-cover group-hover:scale-105 transition-transform duration-300"
                                                            />
                                                        )}
                                                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                                                    </div>
                                                    <div className="absolute bottom-0 left-0 right-0 p-3">
                                                        <h3 className="font-semibold text-white text-sm truncate">{collection.name}</h3>
                                                        <p className="text-xs text-zinc-400">
                                                            {collection.itemCount} item{collection.itemCount !== 1 ? 's' : ''}
                                                        </p>
                                                    </div>
                                                </div>
                                            </Link>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-zinc-500 text-sm italic">
                                        No public collections yet
                                    </p>
                                )}
                            </Card>
                        </TabsContent>

                        <TabsContent value="challenges">
                            <div className="space-y-6">
                                {/* Active Challenges */}
                                <Card className="bg-zinc-900/50 border-white/10 p-6 backdrop-blur-sm">
                                    <h2 className="text-lg font-semibold text-zinc-100 mb-4 flex items-center gap-2">
                                        <Trophy className="h-5 w-5 text-yellow-500" />
                                        Active Challenges
                                    </h2>
                                    {activeChallenges.length > 0 ? (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {activeChallenges.map((c) => {
                                                const total = c.category.items?.length || 1; // Prevent div by zero
                                                const percent = Math.min(100, Math.round((c.progress / total) * 100));
                                                return (
                                                    <Link key={c.categoryId} href={`/categories/${c.categoryId}`}>
                                                        <div className="p-4 rounded-lg bg-zinc-800/50 border border-white/10 hover:border-yellow-500/30 transition-all cursor-pointer">
                                                            <div className="flex items-center gap-3 mb-3">
                                                                <div className="h-10 w-10 relative rounded overflow-hidden flex-shrink-0">
                                                                    {c.category.image ? (
                                                                        <Image src={c.category.image} alt={c.category.name} fill className="object-cover" />
                                                                    ) : (
                                                                        <div className="w-full h-full bg-zinc-700" />
                                                                    )}
                                                                </div>
                                                                <div className="min-w-0">
                                                                    <div className="font-medium text-white truncate">{c.category.name}</div>
                                                                    <div className="text-xs text-zinc-400">{c.progress} / {total} items</div>
                                                                </div>
                                                            </div>
                                                            <div className="space-y-1">
                                                                <div className="flex justify-between text-xs text-zinc-400">
                                                                    <span>Progress</span>
                                                                    <span>{percent}%</span>
                                                                </div>
                                                                <Progress value={percent} className="h-2 bg-zinc-700" />
                                                            </div>
                                                        </div>
                                                    </Link>
                                                )
                                            })}
                                        </div>
                                    ) : (
                                        <p className="text-zinc-500 text-sm italic">
                                            No active challenges. Join one from the homepage!
                                        </p>
                                    )}
                                </Card>

                                {/* Trophy Case */}
                                <Card className="bg-zinc-900/50 border-white/10 p-6 backdrop-blur-sm">
                                    <h2 className="text-lg font-semibold text-zinc-100 mb-4 flex items-center gap-2">
                                        <Hexagon className="h-5 w-5 text-yellow-400" />
                                        Trophy Case
                                    </h2>
                                    {completedChallenges.length > 0 ? (
                                        <div className="flex flex-wrap gap-6">
                                            {completedChallenges.map((c) => (
                                                <div key={c.categoryId} className="flex flex-col items-center gap-2 group">
                                                    <div className="relative w-16 h-16 flex items-center justify-center">
                                                        <Hexagon className="w-full h-full text-zinc-800 fill-zinc-800 absolute" strokeWidth={1} />
                                                        <Hexagon className="w-full h-full text-yellow-500/20 absolute scale-105 animate-pulse" strokeWidth={2} />
                                                        <div className="w-12 h-12 relative z-10 clip-hexagon overflow-hidden">
                                                            {c.category.image && (
                                                                <Image src={c.category.image} alt={c.category.name} fill className="object-cover" />
                                                            )}
                                                        </div>
                                                        <div className="absolute -bottom-2 -right-2 bg-yellow-500 text-black text-[10px] font-bold px-1.5 py-0.5 rounded-full border border-yellow-400">
                                                            100%
                                                        </div>
                                                    </div>
                                                    <span className="text-xs text-zinc-300 font-medium max-w-[80px] text-center truncate group-hover:text-yellow-400 transition-colors">
                                                        {c.category.name}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-zinc-500 text-sm italic">
                                            Complete challenges to earn trophies.
                                        </p>
                                    )}
                                </Card>
                            </div>
                        </TabsContent>

                        <TabsContent value="likes">
                            <Card className="bg-zinc-900/50 border-white/10 p-6 backdrop-blur-sm">
                                <h2 className="text-lg font-semibold text-zinc-100 mb-4">Liked Collections</h2>
                                <p className="text-zinc-500 text-sm italic">
                                    No liked collections yet.
                                </p>
                            </Card>
                        </TabsContent>
                    </Tabs>
                </div>

                {isOwner && (
                    <ProfileEditor
                        isOpen={showEditor}
                        onOpenChange={setShowEditor}
                        onSuccess={handleEditSuccess}
                    />
                )}

                {isOwner && (
                    <TopPicksDialog
                        isOpen={showPickDialog}
                        onOpenChange={setShowPickDialog}
                        onSuccess={() => {
                            router.refresh()
                        }}
                    />
                )}
            </div>
        </>
    )
}
