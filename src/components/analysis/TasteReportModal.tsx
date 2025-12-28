'use client'

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { TasteAnalysis } from "@/lib/types/analysis"
import { Brain } from "lucide-react"
import { AnalysisLoadingState } from "./AnalysisLoadingState"
import { AnalysisErrorState } from "./AnalysisErrorState"
import { useMediaQuery } from "@/hooks/use-media-query"
import { TasteReportContent } from "./TasteReportContent"

interface TasteReportModalProps {
    isOpen: boolean
    onOpenChange: (open: boolean) => void
    data: TasteAnalysis | null
    categoryId?: string
    error?: string | null        // Error message to display
    isLoading?: boolean          // Explicit loading state
    onRetry?: () => void         // Retry callback
    canEdit?: boolean
}

export function TasteReportModal({
    isOpen,
    onOpenChange,
    data,
    categoryId,
    error,
    isLoading,
    onRetry,
    canEdit
}: TasteReportModalProps) {
    const isDesktop = useMediaQuery("(min-width: 768px)")

    // Error State - Show friendly error with retry option
    if (error && isOpen) {
        return (
            <Dialog open={isOpen} onOpenChange={onOpenChange}>
                <DialogContent className="sm:max-w-[500px] h-fit bg-zinc-950 border-zinc-800 p-0 overflow-hidden">
                    <AnalysisErrorState
                        message={error}
                        onRetry={onRetry}
                        onClose={() => onOpenChange(false)}
                    />
                </DialogContent>
            </Dialog>
        )
    }

    // Loading State - Either explicit isLoading or data is null
    if ((isLoading || !data) && isOpen) {
        return (
            <Dialog open={isOpen} onOpenChange={onOpenChange}>
                <DialogContent className="sm:max-w-[500px] h-fit bg-zinc-950 border-zinc-800 p-0 overflow-hidden">
                    <AnalysisLoadingState />
                </DialogContent>
            </Dialog>
        )
    }

    if (!data) return null

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent
                className={isDesktop
                    ? "sm:max-w-[90vw] md:max-w-6xl h-fit max-h-[90vh] overflow-y-auto bg-zinc-950/95 border-zinc-800/50 backdrop-blur-xl p-0 gap-0"
                    : "fixed top-auto bottom-0 translate-y-0 !translate-x-0 left-0 right-0 w-full max-w-full h-[85vh] rounded-t-xl rounded-b-none border-t border-zinc-800 bg-zinc-950 p-0 gap-0 overflow-hidden data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom duration-300"
                }
            >
                <div className="p-6 border-b border-white/10 bg-zinc-900/50 backdrop-blur-xl shrink-0">
                    <DialogHeader>
                        <DialogTitle className="text-2xl flex items-center gap-2 font-serif italic text-white/90">
                            <Brain className="w-6 h-6 text-blue-500" />
                            Taste Report Card
                        </DialogTitle>
                        <DialogDescription className="text-zinc-400">
                            A deep dive into your unique preferences and ranking habits.
                        </DialogDescription>
                    </DialogHeader>
                </div>

                <TasteReportContent data={data} categoryId={categoryId} canEdit={canEdit} />
            </DialogContent>
        </Dialog>
    )
}

