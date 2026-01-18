'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Flag, Loader2, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'
import { submitReport, type ReportReason } from '@/lib/actions/reports'

interface ReportItemDialogProps {
    globalItemId: string
    itemTitle: string
    open: boolean
    onOpenChange: (open: boolean) => void
}

const REASON_OPTIONS: { value: ReportReason; label: string; description: string }[] = [
    { value: 'inaccurate_data', label: 'Inaccurate Data', description: 'Wrong information, incorrect metadata, or outdated details' },
    { value: 'duplicate', label: 'Duplicate', description: 'This item is a duplicate of another entry' },
    { value: 'inappropriate', label: 'Inappropriate Content', description: 'Content that violates community guidelines' },
    { value: 'other', label: 'Other', description: 'Another issue not listed above' },
]

export default function ReportItemDialog({
    globalItemId,
    itemTitle,
    open,
    onOpenChange,
}: ReportItemDialogProps) {
    const [reason, setReason] = useState<ReportReason | ''>('')
    const [details, setDetails] = useState('')
    const [isSubmitting, setIsSubmitting] = useState(false)

    const handleSubmit = async () => {
        if (!reason) {
            toast.error('Please select a reason')
            return
        }

        setIsSubmitting(true)
        try {
            const result = await submitReport(globalItemId, reason, details)

            if (result.success) {
                toast.success('Report submitted for review', {
                    description: 'Thank you for helping improve our data quality.',
                })
                onOpenChange(false)
                setReason('')
                setDetails('')
            } else {
                toast.error(result.error || 'Failed to submit report')
            }
        } catch (_error) {
            toast.error('An unexpected error occurred')
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="bg-zinc-950 border-zinc-800 sm:max-w-[480px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-zinc-100">
                        <Flag className="w-5 h-5 text-amber-500" />
                        Report Item
                    </DialogTitle>
                    <DialogDescription className="text-zinc-400">
                        Report an issue with <span className="text-white font-medium">{itemTitle}</span>
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    {/* Reason Selection */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-zinc-300">
                            What's the issue? <span className="text-red-400">*</span>
                        </label>
                        <Select value={reason} onValueChange={(v) => setReason(v as ReportReason)}>
                            <SelectTrigger className="bg-zinc-900 border-zinc-800 text-zinc-200">
                                <SelectValue placeholder="Select a reason..." />
                            </SelectTrigger>
                            <SelectContent className="bg-zinc-900 border-zinc-800">
                                {REASON_OPTIONS.map((opt) => (
                                    <SelectItem key={opt.value} value={opt.value} className="text-zinc-300 focus:bg-zinc-800 focus:text-white">
                                        <div className="flex flex-col">
                                            <span>{opt.label}</span>
                                        </div>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {reason && (
                            <p className="text-xs text-zinc-500">
                                {REASON_OPTIONS.find(o => o.value === reason)?.description}
                            </p>
                        )}
                    </div>

                    {/* Details */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-zinc-300">
                            Additional details <span className="text-zinc-500">(optional)</span>
                        </label>
                        <Textarea
                            value={details}
                            onChange={(e) => setDetails(e.target.value)}
                            placeholder="Describe the issue in more detail..."
                            className="bg-zinc-900 border-zinc-800 text-zinc-200 placeholder:text-zinc-600 min-h-[100px] resize-none"
                            maxLength={500}
                        />
                        <p className="text-xs text-zinc-600 text-right">{details.length}/500</p>
                    </div>

                    {/* Info Alert */}
                    <div className="flex items-start gap-2 p-3 bg-blue-950/30 border border-blue-900/30 rounded-lg">
                        <AlertCircle className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" />
                        <p className="text-xs text-blue-300/80">
                            Reports are reviewed by our team. We'll take action if the issue is confirmed.
                        </p>
                    </div>
                </div>

                <DialogFooter className="gap-2 sm:gap-0">
                    <Button
                        variant="ghost"
                        onClick={() => onOpenChange(false)}
                        disabled={isSubmitting}
                        className="text-zinc-400 hover:text-white"
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={!reason || isSubmitting}
                        className="bg-amber-600 hover:bg-amber-500 text-white"
                    >
                        {isSubmitting ? (
                            <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Submitting...
                            </>
                        ) : (
                            <>
                                <Flag className="w-4 h-4 mr-2" />
                                Submit Report
                            </>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
