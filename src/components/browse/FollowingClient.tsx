'use client'

import Link from 'next/link'
import { Users, UserPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Card, CardContent } from '@/components/ui/card'

interface FollowedUser {
    id: string
    name: string
    email: string
    image: string | null
    bio: string | null
    createdAt: Date
}

interface FollowingClientProps {
    users: FollowedUser[]
}

export function FollowingClient({ users }: FollowingClientProps) {
    return (
        <div className="space-y-6">
            {/* Header */}
            <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold flex items-center gap-3">
                        <Users className="h-8 w-8 text-blue-400" />
                        Following
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        Users you're following ({users.length})
                    </p>
                </div>
            </header>

            {/* User List */}
            {users.length === 0 ? (
                <div className="text-center py-20">
                    <UserPlus className="h-16 w-16 mx-auto text-zinc-700 mb-4" />
                    <h2 className="text-xl font-semibold mb-2">Not following anyone yet</h2>
                    <p className="text-muted-foreground mb-6">
                        Browse collections and follow creators you like
                    </p>
                    <Link href="/browse">
                        <Button>Browse Collections</Button>
                    </Link>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {users.map((user) => (
                        <Link key={user.id} href={`/profile/${user.id}`}>
                            <Card className="border-white/10 bg-black/40 hover:bg-black/60 transition-colors cursor-pointer">
                                <CardContent className="p-4">
                                    <div className="flex items-center gap-4">
                                        <Avatar className="h-12 w-12 border border-white/10">
                                            <AvatarImage src={user.image || ''} />
                                            <AvatarFallback className="bg-zinc-800 text-zinc-400">
                                                {user.name?.[0]?.toUpperCase() || '?'}
                                            </AvatarFallback>
                                        </Avatar>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-semibold truncate">{user.name}</p>
                                            <p className="text-sm text-muted-foreground truncate">
                                                {user.bio || user.email}
                                            </p>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    )
}
