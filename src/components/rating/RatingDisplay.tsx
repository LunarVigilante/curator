import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"

interface RatingDisplayProps {
    rating: {
        value: number
        tier: string | null
        type: string
    } | null | undefined
    showLabel?: boolean
    className?: string
    variant?: 'badge' | 'bar' | 'ring'
}

export function RatingDisplay({ rating, showLabel = true, className, variant = 'badge' }: RatingDisplayProps) {
    if (!rating) {
        return <span className="text-muted-foreground text-xs">Unranked</span>
    }

    const isTier = rating.type === 'TIER'

    // Tier Colors
    const getTierColor = (tier: string) => {
        switch (tier) {
            case 'S': return 'bg-red-500 hover:bg-red-600 border-red-600'
            case 'A': return 'bg-orange-500 hover:bg-orange-600 border-orange-600'
            case 'B': return 'bg-yellow-500 hover:bg-yellow-600 border-yellow-600'
            case 'C': return 'bg-green-500 hover:bg-green-600 border-green-600'
            case 'D': return 'bg-blue-600 hover:bg-blue-700 border-blue-600'
            case 'F': return 'bg-blue-600 hover:bg-blue-700 border-blue-600'
            default: return 'bg-gray-500'
        }
    }

    // Score Colors
    const getScoreColor = (score: number) => {
        if (score >= 90) return 'text-emerald-500'
        if (score >= 80) return 'text-green-500'
        if (score >= 70) return 'text-lime-500'
        if (score >= 60) return 'text-yellow-500'
        if (score >= 40) return 'text-orange-500'
        return 'text-red-500'
    }

    const getScoreBadgeColor = (score: number) => {
        if (score >= 90) return 'bg-emerald-500 hover:bg-emerald-600'
        if (score >= 80) return 'bg-green-500 hover:bg-green-600'
        if (score >= 70) return 'bg-lime-500 hover:bg-lime-600'
        if (score >= 60) return 'bg-yellow-500 hover:bg-yellow-600'
        if (score >= 40) return 'bg-orange-500 hover:bg-orange-600'
        return 'bg-red-500 hover:bg-red-600'
    }

    if (isTier) {
        return (
            <Badge className={cn("font-bold", getTierColor(rating.tier || ''), className)}>
                {showLabel && "Tier "} {rating.tier}
            </Badge>
        )
    }

    if (variant === 'bar') {
        return (
            <div className={cn("flex items-center gap-2 w-full", className)}>
                <Progress value={rating.value} className="h-2" indicatorClassName={getScoreBadgeColor(rating.value)} />
                <span className={cn("font-bold text-sm w-8 text-right", getScoreColor(rating.value))}>
                    {rating.value}
                </span>
            </div>
        )
    }

    return (
        <Badge className={cn("font-bold", getScoreBadgeColor(rating.value), className)}>
            {rating.value}
        </Badge>
    )
}
