'use client';

import { useState, useEffect } from 'react';
import { getVectorTextPreview } from '@/lib/services/GlobalItemService';
import { ChevronDown, ChevronUp, Brain, RefreshCw, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface VectorPreviewProps {
    title: string;
    categoryType: string;
    metadata: Record<string, any> | string | null;
    description?: string | null;
    source?: string | null;
    externalId?: string | null;
    lastUpdated?: Date | string | null;
    onRegenerate?: () => void;
}

/**
 * Vector Preview Panel
 * 
 * Shows the generated vectorText (AI "Brain" text) for an item.
 * Useful in Admin UI to verify metadata is being captured correctly.
 */
export function VectorPreview({
    title,
    categoryType,
    metadata,
    description,
    source,
    externalId,
    lastUpdated,
    onRegenerate,
}: VectorPreviewProps) {
    const [isExpanded, setIsExpanded] = useState(false);
    const [vectorText, setVectorText] = useState<string>('');
    const [copied, setCopied] = useState(false);

    // Generate vector text on mount and when dependencies change
    useEffect(() => {
        const text = getVectorTextPreview({
            title,
            categoryType: categoryType || 'MOVIE',
            metadata,
            description,
        });
        setVectorText(text);
    }, [title, categoryType, metadata, description]);

    // Handle copy to clipboard
    const handleCopy = async () => {
        await navigator.clipboard.writeText(vectorText);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    // Format last updated date
    const formatDate = (date: Date | string | null): string => {
        if (!date) return 'Never';
        const d = typeof date === 'string' ? new Date(date) : date;
        return d.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        });
    };

    // Check if stale (>30 days)
    const isStale = (): boolean => {
        if (!lastUpdated) return true;
        const d = typeof lastUpdated === 'string' ? new Date(lastUpdated) : lastUpdated;
        const diffDays = (Date.now() - d.getTime()) / (1000 * 60 * 60 * 24);
        return diffDays > 30;
    };

    return (
        <div className="border rounded-lg overflow-hidden bg-muted/30">
            {/* Header */}
            <button
                type="button"
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors"
            >
                <div className="flex items-center gap-2">
                    <Brain className="w-4 h-4 text-purple-500" />
                    <span className="font-medium text-sm">Vector Preview</span>
                    {source && (
                        <Badge variant="secondary" className="text-xs">
                            {source.toUpperCase()}
                        </Badge>
                    )}
                    {isStale() && (
                        <Badge variant="destructive" className="text-xs">
                            Stale
                        </Badge>
                    )}
                </div>
                {isExpanded ? (
                    <ChevronUp className="w-4 h-4 text-muted-foreground" />
                ) : (
                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                )}
            </button>

            {/* Expanded Content */}
            {isExpanded && (
                <div className="px-4 pb-4 space-y-3">
                    {/* Metadata Row */}
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        {externalId && (
                            <span>
                                ID: <code className="bg-muted px-1 rounded">{externalId}</code>
                            </span>
                        )}
                        <span>Type: {categoryType || 'Unknown'}</span>
                        <span>Updated: {formatDate(lastUpdated)}</span>
                    </div>

                    {/* Vector Text Code Block */}
                    <div className="relative">
                        <pre className="bg-black/80 text-green-400 p-3 rounded-md text-xs font-mono overflow-x-auto max-h-48 overflow-y-auto whitespace-pre-wrap">
                            {vectorText || 'No vector text generated'}
                        </pre>

                        {/* Copy Button */}
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="absolute top-2 right-2 h-7 px-2"
                            onClick={handleCopy}
                        >
                            {copied ? (
                                <Check className="w-3 h-3 text-green-500" />
                            ) : (
                                <Copy className="w-3 h-3" />
                            )}
                        </Button>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">
                            {vectorText.length} characters
                        </span>
                        {onRegenerate && (
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={onRegenerate}
                                className="h-7 text-xs"
                            >
                                <RefreshCw className="w-3 h-3 mr-1" />
                                Regenerate
                            </Button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
