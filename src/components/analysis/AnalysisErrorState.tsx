'use client'

import { Button } from "@/components/ui/button"
import { AlertTriangle, RefreshCw } from "lucide-react"

interface AnalysisErrorStateProps {
    message?: string
    onRetry?: () => void
    onClose?: () => void
}

export function AnalysisErrorState({
    message = "Analysis unavailable",
    onRetry,
    onClose
}: AnalysisErrorStateProps) {
    return (
        <div className="flex flex-col items-center justify-center min-h-[400px] w-full p-8 text-center space-y-6">
            {/* Error Icon */}
            <div className="relative">
                <div className="absolute inset-0 bg-red-500/20 blur-xl rounded-full" />
                <div className="relative h-20 w-20 rounded-full bg-zinc-900 border border-red-500/30 flex items-center justify-center shadow-2xl">
                    <AlertTriangle className="h-10 w-10 text-red-400" />
                </div>
            </div>

            {/* Error Message */}
            <div className="space-y-2 max-w-sm">
                <h3 className="text-xl font-semibold text-zinc-200">
                    {message}
                </h3>
                <p className="text-sm text-zinc-500">
                    The AI analysis could not be completed. This may be due to a temporary issue with the AI service.
                </p>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
                {onRetry && (
                    <Button
                        onClick={onRetry}
                        variant="default"
                        className="gap-2"
                    >
                        <RefreshCw className="h-4 w-4" />
                        Try Again
                    </Button>
                )}
                {onClose && (
                    <Button
                        onClick={onClose}
                        variant="ghost"
                    >
                        Close
                    </Button>
                )}
            </div>
        </div>
    )
}
