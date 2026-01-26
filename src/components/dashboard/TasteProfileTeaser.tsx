import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Radar, Lock } from 'lucide-react'
import { cn } from '@/lib/utils'

interface TasteProfileTeaserProps {
    className?: string
}

export default function TasteProfileTeaser({ className }: TasteProfileTeaserProps) {
    return (
        <Card className={cn(
            "bg-zinc-900/50 backdrop-blur-md border-white/10 overflow-hidden relative group",
            className
        )}>
            <CardHeader className="pb-2 relative z-10">
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                    <Radar className="h-5 w-5 text-zinc-400" />
                    Your Taste Profile
                </CardTitle>
            </CardHeader>
            <CardContent className="relative z-10 flex flex-col items-center justify-center py-8 space-y-4">
                <div className="text-center space-y-2 max-w-[80%] mx-auto">
                    <p className="text-zinc-200 font-medium">
                        Unlock your Snob Score & Taste Analysis
                    </p>
                    <p className="text-sm text-zinc-400">
                        Rate 10 items to generate your unique taste profile and see how you compare to the community.
                    </p>
                </div>

                <div className="pt-2">
                    <Button
                        disabled
                        variant="outline"
                        className="bg-white/5 border-white/10 text-zinc-500 gap-2 cursor-not-allowed hover:bg-white/5"
                    >
                        <Lock className="h-3.5 w-3.5" />
                        Analysis Locked
                    </Button>
                </div>
            </CardContent>

            {/* Decorative Background Icon */}
            <div className="absolute inset-0 flex items-center justify-center opacity-[0.03] pointer-events-none overflow-hidden">
                <Radar className="w-64 h-64 text-zinc-100 transform rotate-12" strokeWidth={1} />
            </div>

            {/* Subtle Gradient Overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent pointer-events-none" />
        </Card>
    )
}
