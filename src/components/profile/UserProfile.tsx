import { getUserById } from "@/lib/actions/users";
import { calculateTasteMatch } from "@/lib/matchmaking";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { TasteMatchBadge } from "./TasteMatchBadge";
import { Calendar } from "lucide-react";

interface UserProfileProps {
    userId: string;
}

export async function UserProfile({ userId }: UserProfileProps) {
    const user = await getUserById(userId);

    if (!user) {
        return <div>User not found</div>;
    }

    const session = await auth.api.getSession({
        headers: await headers()
    });

    const isOwnProfile = session?.user?.id === userId;
    let matchScore: number | null = null;

    if (session && !isOwnProfile) {
        matchScore = await calculateTasteMatch(session.user.id, userId);
    }

    return (
        <div className="flex flex-col md:flex-row gap-6 items-start md:items-center bg-black/20 border border-white/10 p-8 rounded-2xl backdrop-blur-sm">
            <div className="relative">
                <Avatar className="h-24 w-24 border-2 border-white/10 shadow-xl">
                    <AvatarImage src={user.image || ''} alt={user.name} />
                    <AvatarFallback className="text-2xl bg-zinc-800">{user.name[0]}</AvatarFallback>
                </Avatar>
                {/* Status Indicator (Optional) */}
            </div>

            <div className="flex-1 space-y-2">
                <div className="flex items-center gap-3 flex-wrap">
                    <h1 className="text-3xl font-bold text-white tracking-tight">{user.name}</h1>

                    {matchScore !== null && (
                        <TasteMatchBadge score={matchScore} />
                    )}
                </div>

                {user.bio && (
                    <p className="text-zinc-300 max-w-lg leading-relaxed">
                        {user.bio}
                    </p>
                )}

                <div className="flex items-center gap-4 text-sm text-zinc-500 pt-2">
                    <div className="flex items-center gap-1.5">
                        <Calendar className="w-4 h-4" />
                        <span>Joined {new Date(user.createdAt).toLocaleDateString()}</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
