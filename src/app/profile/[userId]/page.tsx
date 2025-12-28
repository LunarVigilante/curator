import { getPublicProfile, getUserPublicCollections } from '@/lib/actions/profile'
import { getJoinedChallenges } from '@/lib/actions/challenges'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { ProfileView } from './ProfileView'

interface ProfilePageProps {
    params: Promise<{ userId: string }>
}

export default async function ProfilePage({ params }: ProfilePageProps) {
    const { userId } = await params
    const [profile, collections, challenges] = await Promise.all([
        getPublicProfile(userId),
        getUserPublicCollections(userId),
        getJoinedChallenges(userId)
    ])

    if (!profile) {
        notFound()
    }

    // Check if current user is the owner
    const session = await auth.api.getSession({ headers: await headers() })
    const isOwner = session?.user?.id === userId

    return <ProfileView profile={profile} collections={collections} challenges={challenges} isOwner={isOwner} />
}

