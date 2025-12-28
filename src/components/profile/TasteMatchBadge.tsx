import { Badge } from "@/components/ui/badge";
import { Sparkles, Zap, HeartHandshake, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

interface TasteMatchBadgeProps {
    score: number;
    className?: string;
}

export function TasteMatchBadge({ score, className }: TasteMatchBadgeProps) {
    let label = '';
    let colorClass = '';
    let icon = null;

    if (score >= 90) {
        label = 'Soulmates';
        colorClass = 'bg-green-500/20 text-green-400 border-green-500/50 hover:bg-green-500/30';
        icon = <HeartHandshake className="w-3.5 h-3.5 mr-1.5" />;
    } else if (score >= 70) {
        label = 'High Compatibility';
        colorClass = 'bg-blue-500/20 text-blue-400 border-blue-500/50 hover:bg-blue-500/30';
        icon = <Sparkles className="w-3.5 h-3.5 mr-1.5" />;
    } else if (score >= 50) {
        label = 'Balanced';
        colorClass = 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50 hover:bg-yellow-500/30';
        icon = <RefreshCw className="w-3.5 h-3.5 mr-1.5" />;
    } else {
        label = 'Opposites';
        colorClass = 'bg-red-500/20 text-red-400 border-red-500/50 hover:bg-red-500/30';
        icon = <Zap className="w-3.5 h-3.5 mr-1.5" />;
    }

    return (
        <Badge variant="outline" className={cn("cursor-default transition-all gap-1.5 py-1 px-2.5", colorClass, className)} title="Based on shared item ratings">
            {icon}
            <span className="font-semibold">{label}</span>
            <span className="opacity-70 text-[10px] ml-0.5">({score}%)</span>
        </Badge>
    );
}
