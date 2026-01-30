'use client';

import React from 'react';
import { TasteAnalysis } from '@/lib/types/analysis';
import { ThumbsUp, AlertTriangle, Palette, BookOpen, Compass } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface ProfileHighlightCardProps {
    data: TasteAnalysis;
}

/**
 * Displays a randomly selected highlight from the taste analysis profile.
 * Cycles between: high rated patterns, visual style, narrative preference,
 * unexplored themes (growth), and outliers.
 */
export function ProfileHighlightCard({ data }: ProfileHighlightCardProps) {
    const [highlight, setHighlight] = React.useState<'high_rated' | 'visual' | 'narrative' | 'growth' | 'outliers'>('visual');

    React.useEffect(() => {
        const types: Array<'high_rated' | 'visual' | 'narrative' | 'growth' | 'outliers'> = ['high_rated', 'visual', 'narrative', 'growth', 'outliers'];
        const hasGrowth = !!data.analysis.unexplored_themes;
        const hasOutliers = !!data.analysis.outliers?.trim() && data.analysis.outliers !== "None identified.";

        // Filter eligible types
        const eligible = types.filter(t => {
            if (t === 'growth' && !hasGrowth) return false;
            if (t === 'outliers' && !hasOutliers) return false;
            return true;
        });

        const random = eligible[Math.floor(Math.random() * eligible.length)];
        setHighlight(random);
    }, [data]);

    // Common Markdown components for card
    const CardMarkdown = {
        p: ({ ...props }: any) => <p className="mb-2 last:mb-0 leading-relaxed" {...props} />
    };

    if (highlight === 'high_rated') {
        return (
            <div className="p-6 rounded-xl bg-gradient-to-br from-emerald-900/20 to-green-900/10 border border-emerald-500/20 h-full text-left">
                <h4 className="text-sm font-semibold text-emerald-300 uppercase tracking-wider mb-4 flex items-center gap-2">
                    <ThumbsUp className="w-4 h-4" /> What You Love
                </h4>
                <div className="text-zinc-100 text-base">
                    <ReactMarkdown components={{
                        ...CardMarkdown,
                        strong: ({ ...props }: any) => <span className="font-bold text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-green-300" {...props} />
                    }}>
                        {data.analysis.high_rated_patterns}
                    </ReactMarkdown>
                </div>
            </div>
        );
    }

    if (highlight === 'visual') {
        return (
            <div className="p-6 rounded-xl bg-gradient-to-br from-blue-900/20 to-cyan-900/10 border border-blue-500/20 h-full text-left">
                <h4 className="text-sm font-semibold text-blue-300 uppercase tracking-wider mb-4 flex items-center gap-2">
                    <Palette className="w-4 h-4" /> Visual Style
                </h4>
                <div className="text-zinc-100 text-base">
                    <ReactMarkdown components={{
                        ...CardMarkdown,
                        strong: ({ ...props }: any) => <span className="font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400" {...props} />
                    }}>
                        {data.profile.visual_style}
                    </ReactMarkdown>
                </div>
            </div>
        );
    }

    if (highlight === 'narrative') {
        return (
            <div className="p-6 rounded-xl bg-gradient-to-br from-blue-900/20 to-indigo-900/10 border border-blue-500/20 h-full text-left">
                <h4 className="text-sm font-semibold text-blue-300 uppercase tracking-wider mb-4 flex items-center gap-2">
                    <BookOpen className="w-4 h-4" /> Narrative DNA
                </h4>
                <div className="text-zinc-100 text-base">
                    <ReactMarkdown components={{
                        ...CardMarkdown,
                        strong: ({ ...props }: any) => <span className="font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400" {...props} />
                    }}>
                        {data.profile.narrative_preference}
                    </ReactMarkdown>
                </div>
            </div>
        );
    }

    if (highlight === 'growth') {
        return (
            <div className="p-6 rounded-xl bg-gradient-to-br from-amber-900/20 to-yellow-900/10 border border-amber-500/20 h-full text-left">
                <h4 className="text-sm font-semibold text-amber-300 uppercase tracking-wider mb-4 flex items-center gap-2">
                    <Compass className="w-4 h-4" /> Room for Growth
                </h4>
                <div className="text-zinc-100 text-base">
                    <ReactMarkdown components={{
                        ...CardMarkdown,
                        strong: ({ ...props }: any) => <span className="font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-yellow-200" {...props} />
                    }}>
                        {data.analysis.unexplored_themes}
                    </ReactMarkdown>
                </div>
            </div>
        );
    }

    if (highlight === 'outliers') {
        return (
            <div className="p-6 rounded-xl bg-gradient-to-br from-zinc-800/40 to-zinc-900/40 border border-zinc-700/30 h-full text-left">
                <h4 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" /> Blind Spots & Outliers
                </h4>
                <div className="text-zinc-300 text-base">
                    <ReactMarkdown components={{
                        ...CardMarkdown,
                        strong: ({ ...props }: any) => <span className="font-semibold text-white" {...props} />
                    }}>
                        {data.analysis.outliers}
                    </ReactMarkdown>
                </div>
            </div>
        );
    }

    return null;
}
