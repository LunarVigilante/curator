'use client'

import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Trophy, ArrowRight, Loader2, Sparkles } from 'lucide-react';
import { acceptChallengeTemplate } from '@/lib/actions/challenges';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

interface ChallengeCardProps {
    challenge: {
        id: string;
        name: string;
        description: string | null;
        image: string | null;
        emoji: string | null;
    } | null;
}

export default function ChallengeCard({ challenge }: ChallengeCardProps) {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);

    if (!challenge) return null;

    const handleAccept = async () => {
        setIsLoading(true);
        try {
            const result = await acceptChallengeTemplate(challenge.id);
            toast.success("Challenge Accepted! Let's start ranking.");
            // Immediately redirect to Face-Off mode
            router.push(`/categories/${result.categoryId}?mode=tournament`);
        } catch (error) {
            toast.error("Failed to accept challenge.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Card className="relative overflow-hidden border-none bg-zinc-900 group">
            {/* Background Image with Gradient */}
            {challenge.image && (
                <div className="absolute inset-0 z-0">
                    <img
                        src={challenge.image}
                        className="w-full h-full object-cover opacity-20 group-hover:opacity-30 group-hover:scale-105 transition-all duration-700"
                        alt=""
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/80 to-transparent" />
                </div>
            )}

            <div className="relative z-10 p-6 flex flex-col h-full min-h-[220px]">
                <div className="flex items-center gap-2 mb-4">
                    <div className="bg-yellow-500/10 p-2 rounded-lg border border-yellow-500/20">
                        <Trophy className="h-5 w-5 text-yellow-500" />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-yellow-500/80">Weekly Challenge</span>
                </div>

                <div className="mt-auto space-y-4">
                    <div>
                        <h2 className="text-3xl font-black tracking-tight text-white mb-2 leading-none">
                            {challenge.emoji && <span className="mr-2">{challenge.emoji}</span>}
                            {challenge.name}
                        </h2>
                        <p className="text-zinc-400 text-sm line-clamp-2 max-w-lg">
                            {challenge.description || "Join this community challenge and see how your taste compares to the global average."}
                        </p>
                    </div>

                    <Button
                        onClick={handleAccept}
                        disabled={isLoading}
                        className="w-full md:w-auto bg-white text-black hover:bg-zinc-200 h-12 px-8 font-bold rounded-xl shadow-xl shadow-white/5 transition-all transform active:scale-95"
                    >
                        {isLoading ? (
                            <>
                                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                Cloning Template...
                            </>
                        ) : (
                            <>
                                Accept Challenge
                                <ArrowRight className="ml-2 h-5 w-5" />
                            </>
                        )}
                    </Button>
                </div>
            </div>

            {/* Subtle Sparkle Decor */}
            <div className="absolute top-4 right-4 text-white/5 group-hover:text-blue-500/20 transition-colors">
                <Sparkles className="h-12 w-12" />
            </div>
        </Card>
    );
}
