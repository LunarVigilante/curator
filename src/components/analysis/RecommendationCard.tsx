'use client';

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Plus, Check, Loader2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

export interface RecommendationCardProps {
    item: {
        name: string;
        year?: string;
        medium?: string;
        description: string;
        score: number;
        category?: string;
    };
    variant: 'success' | 'danger';
    isAdded?: boolean;
    onAdd?: () => void;
    isAdding?: boolean;
}

/**
 * Card component for displaying recommendations and anti-recommendations
 * with match/friction scores and an optional add button.
 */
export function RecommendationCard({ item, variant, isAdded, onAdd, isAdding }: RecommendationCardProps) {
    const isSuccess = variant === 'success';
    const borderColor = isSuccess ? 'border-l-emerald-500' : 'border-l-rose-500';

    // Badge Styles
    const badgeBg = isSuccess ? 'bg-emerald-500/10' : 'bg-amber-500/10';
    const badgeText = isSuccess ? 'text-emerald-400' : 'text-amber-400';
    const badgeBorder = isSuccess ? 'border-emerald-500/20' : 'border-amber-500/20';

    // Metric Logic
    const displayScore = isSuccess ? item.score : (100 - item.score);
    const displayLabel = isSuccess ? 'Match' : 'Friction';

    return (
        <Card className={`border-l-4 ${borderColor} bg-white/5 border-t-0 border-r-0 border-b-0 h-full flex flex-col`}>
            <CardHeader className="pb-3 px-5 pt-5">
                <div className="flex justify-between items-start gap-3">
                    <div className="space-y-1">
                        <h4 className="font-semibold text-lg leading-snug text-white/90">{item.name}</h4>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                            {item.year && <span>{item.year}</span>}
                            {item.year && item.medium && <span className="opacity-50">•</span>}
                            {item.medium && <span className="uppercase tracking-wider opacity-90">{item.medium}</span>}
                        </div>
                    </div>
                    {onAdd && (
                        <Button
                            size="icon"
                            variant="ghost"
                            className={`h-8 w-8 shrink-0 hover:bg-white/10 ${isAdded ? "text-emerald-500" : "text-zinc-400"}`}
                            disabled={isAdding || isAdded}
                            onClick={onAdd}
                        >
                            {isAdding ? (
                                <Loader2 className="w-4 h-4 animate-spin text-zinc-400" />
                            ) : isAdded ? (
                                <Check className="w-4 h-4" />
                            ) : (
                                <Plus className="w-4 h-4" />
                            )}
                        </Button>
                    )}
                </div>
                <div className="pt-2">
                    <Badge variant="outline" className={`${badgeBg} ${badgeText} ${badgeBorder} font-normal`}>
                        {displayScore}% {displayLabel}
                    </Badge>
                </div>
            </CardHeader>
            <CardContent className="px-5 pb-5 flex-1">
                <div className={`text-[15px] leading-relaxed ${isSuccess ? 'text-zinc-300' : 'text-rose-300'}`}>
                    <ReactMarkdown
                        components={{
                            strong: ({ ...props }) => <strong className={isSuccess ? "font-bold text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-green-300" : "text-rose-100 font-semibold"} {...props} />,
                            p: ({ ...props }) => <p className="mb-2 last:mb-0" {...props} />,
                            ul: ({ ...props }) => <ul className="list-disc pl-4 mb-2 space-y-1" {...props} />
                        }}
                    >
                        {item.description}
                    </ReactMarkdown>
                </div>
            </CardContent>
        </Card>
    );
}
