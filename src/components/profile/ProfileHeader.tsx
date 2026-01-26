'use client'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Calendar, Eye, Settings, Users, ImagePlus } from 'lucide-react'
import type { PublicProfile } from '@/lib/actions/profile'

interface ProfileHeaderProps {
    profile: PublicProfile
    isOwner: boolean
    onEditClick?: () => void
    onCoverEditClick?: () => void
}

export function ProfileHeader({ profile, isOwner, onEditClick, onCoverEditClick }: ProfileHeaderProps) {
    const displayName = profile.displayName || profile.name
    const initials = displayName.slice(0, 2).toUpperCase()
    const joinDate = new Date(profile.createdAt).toLocaleDateString('en-US', {
        month: 'long',
        year: 'numeric'
    })

    return (
        <div className="relative">
            {/* Background banner - custom image or premium texture fallback */}
            {profile.coverImage ? (
                <div
                    className="absolute inset-x-0 top-0 h-32 bg-cover bg-center"
                    style={{ backgroundImage: `url(${profile.coverImage})` }}
                />
            ) : (
                <div className="absolute inset-x-0 top-0 h-32 overflow-hidden">
                    {/* Dark gradient base with subtle color hints */}
                    <div className="absolute inset-0 bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900" />
                    {/* Subtle color accent */}
                    <div className="absolute inset-0 bg-gradient-to-r from-purple-900/20 via-transparent to-blue-900/20" />
                    {/* Noise texture overlay */}
                    <div
                        className="absolute inset-0 opacity-40"
                        style={{
                            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
                            backgroundSize: '128px 128px'
                        }}
                    />
                    {/* Bottom fade */}
                    <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-zinc-900/80 to-transparent" />
                </div>
            )}

            {/* Cover edit button (owner only) */}
            {isOwner && onCoverEditClick && (
                <button
                    onClick={onCoverEditClick}
                    className="absolute top-3 right-3 z-10 p-2 rounded-full bg-black/50 hover:bg-black/70 text-white/80 hover:text-white transition-colors"
                    title="Change cover"
                >
                    <ImagePlus className="w-4 h-4" />
                </button>
            )}

            <div className="relative pt-16 px-6 pb-6">
                <div className="flex flex-col md:flex-row gap-6 items-start md:items-end">
                    {/* Avatar */}
                    <Avatar className="w-24 h-24 border-4 border-background shadow-xl">
                        <AvatarImage src={profile.image || undefined} alt={displayName} />
                        <AvatarFallback className="text-2xl font-bold bg-gradient-to-br from-purple-500 to-blue-500 text-white">
                            {initials}
                        </AvatarFallback>
                    </Avatar>

                    {/* Info */}
                    <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-3">
                            <h1 className="text-2xl font-bold text-white">{displayName}</h1>
                            {profile.isPublic && (
                                <Badge variant="secondary" className="bg-green-500/10 text-green-400 border-green-500/20">
                                    Public
                                </Badge>
                            )}
                        </div>

                        {profile.bio && (
                            <p className="text-zinc-400 max-w-xl">{profile.bio}</p>
                        )}

                        <div className="flex flex-wrap gap-4 text-sm text-zinc-500">
                            <span className="flex items-center gap-1">
                                <Calendar className="w-4 h-4" />
                                Joined {joinDate}
                            </span>
                            <span className="flex items-center gap-1">
                                <Eye className="w-4 h-4" />
                                {profile.profileViews} profile views
                            </span>
                            <span className="flex items-center gap-1">
                                <Users className="w-4 h-4" />
                                {profile.stats.followerCount} followers
                            </span>
                        </div>
                    </div>

                    {/* Actions */}
                    {isOwner && onEditClick && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={onEditClick}
                            className="border-white/10 hover:bg-white/5"
                        >
                            <Settings className="w-4 h-4 mr-2" />
                            Edit Profile
                        </Button>
                    )}
                </div>

                {/* Stats */}
                <div className="mt-6 flex gap-6">
                    <div className="text-center">
                        <div className="text-2xl font-bold text-white">{profile.stats.totalItems}</div>
                        <div className="text-sm text-zinc-500">Items Ranked</div>
                    </div>
                    <div className="text-center">
                        <div className="text-2xl font-bold text-white">{profile.stats.totalCollections}</div>
                        <div className="text-sm text-zinc-500">Collections</div>
                    </div>
                </div>
            </div>
        </div>
    )
}
