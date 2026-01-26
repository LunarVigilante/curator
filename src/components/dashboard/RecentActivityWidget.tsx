import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Activity } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function RecentActivityWidget({ className }: { className?: string }) {
    return (
        <Card className={cn(
            "bg-zinc-900/50 backdrop-blur-md border-white/10 h-full",
            className
        )}>
            <CardHeader className="pb-2">
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                    <Activity className="h-5 w-5 text-zinc-400" />
                    Recent Activity
                </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center justify-center py-12 text-center space-y-2">
                <div className="p-3 rounded-full bg-zinc-800/50">
                    <Activity className="h-6 w-6 text-zinc-600" />
                </div>
                <p className="text-zinc-500 font-medium">No recent activity</p>
                <p className="text-xs text-zinc-600 max-w-[200px]">
                    Your interactions and updates will appear here.
                </p>
            </CardContent>
        </Card>
    )
}
