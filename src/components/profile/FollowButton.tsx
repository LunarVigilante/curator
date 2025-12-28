'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { toggleFollow } from '@/lib/actions/social';
import { toast } from 'sonner';
import { UserPlus, UserCheck, Loader2 } from 'lucide-react';

interface FollowButtonProps {
    targetUserId: string;
    initialIsFollowing: boolean;
}

export default function FollowButton({ targetUserId, initialIsFollowing }: FollowButtonProps) {
    const [isFollowing, setIsFollowing] = useState(initialIsFollowing);
    const [isPending, startTransition] = useTransition();

    const handleToggle = () => {
        // Optimistic update
        setIsFollowing(!isFollowing);

        startTransition(async () => {
            try {
                const result = await toggleFollow(targetUserId);
                // Ensure state matches server response
                setIsFollowing(result.isFollowing);
                toast.success(result.isFollowing ? 'Followed user' : 'Unfollowed user');
            } catch (error) {
                // Revert on error
                setIsFollowing(initialIsFollowing);
                toast.error('Failed to update follow status');
            }
        });
    };

    return (
        <Button
            variant={isFollowing ? "secondary" : "default"}
            size="sm"
            onClick={handleToggle}
            disabled={isPending}
            className={`gap-2 transition-all ${isFollowing ? 'bg-zinc-800 text-zinc-300 hover:bg-red-900/20 hover:text-red-400 group' : 'bg-blue-600 hover:bg-blue-500'}`}
        >
            {isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
            ) : isFollowing ? (
                <>
                    <UserCheck className="w-4 h-4 group-hover:hidden" />
                    <UserPlus className="w-4 h-4 hidden group-hover:inline rotate-45" /> {/* Use rotate to simulate remove icon or just swap icons */}
                    <span className="group-hover:hidden">Following</span>
                    <span className="hidden group-hover:inline">Unfollow</span>
                </>
            ) : (
                <>
                    <UserPlus className="w-4 h-4" />
                    Follow
                </>
            )}
        </Button>
    );
}
