'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Clock, CheckCircle2, XCircle, FileText } from 'lucide-react';
import { ReportStats } from '@/lib/actions/reports';

interface ReportStatsCardsProps {
    stats: ReportStats;
}

/**
 * Displays stats cards for the reports dashboard.
 */
export function ReportStatsCards({ stats }: ReportStatsCardsProps) {
    return (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <Card className="bg-zinc-900/50 border-zinc-800">
                <CardContent className="pt-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs text-zinc-500 uppercase tracking-wider">Total</p>
                            <p className="text-2xl font-bold text-white">{stats.total}</p>
                        </div>
                        <FileText className="w-8 h-8 text-zinc-600" />
                    </div>
                </CardContent>
            </Card>
            <Card className="bg-amber-950/20 border-amber-900/30">
                <CardContent className="pt-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs text-amber-500/80 uppercase tracking-wider">Pending</p>
                            <p className="text-2xl font-bold text-amber-400">{stats.pending}</p>
                        </div>
                        <Clock className="w-8 h-8 text-amber-500/50" />
                    </div>
                </CardContent>
            </Card>
            <Card className="bg-green-950/20 border-green-900/30">
                <CardContent className="pt-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs text-green-500/80 uppercase tracking-wider">Resolved</p>
                            <p className="text-2xl font-bold text-green-400">{stats.resolved}</p>
                        </div>
                        <CheckCircle2 className="w-8 h-8 text-green-500/50" />
                    </div>
                </CardContent>
            </Card>
            <Card className="bg-zinc-900/50 border-zinc-800">
                <CardContent className="pt-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs text-zinc-500 uppercase tracking-wider">Dismissed</p>
                            <p className="text-2xl font-bold text-zinc-400">{stats.dismissed}</p>
                        </div>
                        <XCircle className="w-8 h-8 text-zinc-600" />
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
