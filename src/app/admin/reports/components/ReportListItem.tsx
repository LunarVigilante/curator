'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Clock, CheckCircle2, XCircle, User, FileText, ExternalLink, Eye } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { Report, ReportStatus } from '@/lib/actions/reports';

const STATUS_CONFIG: Record<ReportStatus, { label: string; color: string; icon: React.ElementType }> = {
    pending: { label: 'Pending', color: 'bg-amber-500/10 text-amber-500 border-amber-500/20', icon: Clock },
    resolved: { label: 'Resolved', color: 'bg-green-500/10 text-green-500 border-green-500/20', icon: CheckCircle2 },
    dismissed: { label: 'Dismissed', color: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20', icon: XCircle },
};

const REASON_LABELS: Record<string, string> = {
    inaccurate_data: 'Inaccurate Data',
    duplicate: 'Duplicate Entry',
    inappropriate: 'Inappropriate Content',
    other: 'Other Issue',
};

interface ReportListItemProps {
    report: Report;
    onReview: (report: Report) => void;
    formatDate: (dateStr: string) => string;
}

/**
 * Individual report list item with image, status badges, and review button.
 */
export function ReportListItem({ report, onReview, formatDate }: ReportListItemProps) {
    const statusConfig = STATUS_CONFIG[report.status];
    const StatusIcon = statusConfig.icon;

    return (
        <div className="p-4 hover:bg-zinc-800/30 transition-colors">
            <div className="flex gap-4">
                {/* Item Image */}
                <div className="w-16 h-24 rounded bg-zinc-800 overflow-hidden shrink-0 relative">
                    {report.itemImage ? (
                        <Image src={report.itemImage} alt="" fill className="object-cover" />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center">
                            <FileText className="w-6 h-6 text-zinc-700" />
                        </div>
                    )}
                </div>

                {/* Report Details */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <h3 className="font-medium text-white truncate">
                                {report.itemTitle || 'Unknown Item'}
                            </h3>
                            <div className="flex items-center gap-2 mt-1">
                                <Badge className={`${statusConfig.color} border text-xs`}>
                                    <StatusIcon className="w-3 h-3 mr-1" />
                                    {statusConfig.label}
                                </Badge>
                                <Badge variant="outline" className="text-xs border-zinc-700 text-zinc-400">
                                    {REASON_LABELS[report.reason] || report.reason}
                                </Badge>
                            </div>
                        </div>

                        {/* Review Button */}
                        <Button
                            size="sm"
                            variant="outline"
                            className="h-8 text-cyan-400 border-cyan-900/50 hover:bg-cyan-950/50 shrink-0"
                            onClick={() => onReview(report)}
                        >
                            <Eye className="w-3.5 h-3.5 mr-1" />
                            Review
                        </Button>
                    </div>

                    {/* Details */}
                    {report.details && (
                        <p className="text-sm text-zinc-400 mt-2 line-clamp-2">
                            {report.details}
                        </p>
                    )}

                    {/* Meta */}
                    <div className="flex items-center gap-4 mt-3 text-xs text-zinc-500">
                        <span className="flex items-center gap-1">
                            <User className="w-3 h-3" />
                            {report.reporterName || 'Anonymous'}
                        </span>
                        <span>{formatDate(report.createdAt)}</span>
                        <Link
                            href={`/admin/data-browser?id=${report.globalItemId}`}
                            className="text-cyan-500 hover:text-cyan-400 flex items-center gap-1"
                        >
                            <ExternalLink className="w-3 h-3" />
                            View Item
                        </Link>
                    </div>

                    {/* Resolution Notes */}
                    {report.resolutionNotes && (
                        <div className="mt-2 p-2 bg-zinc-800/50 rounded text-xs text-zinc-400 border border-zinc-700/50">
                            <span className="text-zinc-500">Resolution notes:</span> {report.resolutionNotes}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export { STATUS_CONFIG, REASON_LABELS };
