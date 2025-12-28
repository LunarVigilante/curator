'use client';

import { useEffect, useState } from 'react';
import { getRecentActivities } from '@/lib/actions/activity';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2 } from 'lucide-react';
import Link from 'next/link';

interface Activity {
    id: string;
    type: 'RANKED_ITEM' | 'CREATED_LIST' | 'FOLLOWED_USER';
    data: any;
    createdAt: Date;
    user: {
        id: string;
        name: string;
        image: string | null;
    };
}

export default function ActivityFeed({ activities }: { activities: Activity[] }) {
    if (!activities || activities.length === 0) {
        return <div className="text-zinc-500 text-sm italic">No recent activity.</div>;
    }

    return (
        <ScrollArea className="h-[300px] w-full pr-4">
            <div className="space-y-4">
                {activities.map((activity) => (
                    <div key={activity.id} className="flex gap-3 items-start">
                        <Link href={`/u/${activity.user.id}`}>
                            <Avatar className="h-8 w-8 cursor-pointer hover:opacity-80 transition-opacity">
                                <AvatarImage src={activity.user.image || ''} alt={activity.user.name} />
                                <AvatarFallback>{activity.user.name[0]}</AvatarFallback>
                            </Avatar>
                        </Link>
                        <div className="flex-1 space-y-1">
                            <p className="text-sm text-zinc-300 leading-snug">
                                <Link href={`/u/${activity.user.id}`} className="font-semibold text-white hover:underline">
                                    {activity.user.name}
                                </Link>
                                <span className="text-zinc-400">
                                    {renderActivityText(activity)}
                                </span>
                            </p>
                            <p className="text-[10px] text-zinc-600 uppercase tracking-widest font-mono">
                                {new Date(activity.createdAt).toLocaleDateString()}
                            </p>
                        </div>
                    </div>
                ))}
            </div>
        </ScrollArea>
    );
}

function renderActivityText(activity: Activity) {
    const { type, data } = activity;

    switch (type) {
        case 'RANKED_ITEM':
            return (
                <>
                    {' '}ranked <span className="text-green-400 font-medium">{data.winnerName}</span> above <span className="text-red-400/80 font-medium">{data.loserName}</span>
                </>
            );
        case 'CREATED_LIST':
            return (
                <>
                    {' '}created a new collection: <span className="text-blue-400 font-medium">{data.categoryName}</span>
                </>
            );
        case 'FOLLOWED_USER':
            return (
                <>
                    {' '}started following <span className="text-white font-medium">{data.targetUserName || 'a user'}</span>
                </>
            );
        default:
            return ' did something';
    }
}
