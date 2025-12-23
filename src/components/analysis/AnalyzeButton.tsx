'use client'

import { useState } from 'react'
import { Button } from "@/components/ui/button"
import { analyzeUserTaste, TasteAnalysis } from "@/lib/actions/analysis"
import { TasteReportModal } from "./TasteReportModal"
import { Sparkles, Loader2 } from "lucide-react"
import { toast } from "sonner"

interface AnalyzeButtonProps {
    categoryId?: string
    variant?: "outline" | "ghost" | "default" | "secondary" | "destructive" | "link"
}

export function AnalyzeButton({ categoryId, variant = "outline" }: AnalyzeButtonProps) {
    const [isLoading, setIsLoading] = useState(false)
    const [isOpen, setIsOpen] = useState(false)
    const [data, setData] = useState<TasteAnalysis | null>(null)

    const handleAnalyze = async () => {
        setIsLoading(true)
        try {
            const result = await analyzeUserTaste(categoryId)
            setData(result)
            setIsOpen(true)
            toast.success("Analysis Complete", {
                description: "Your taste report is ready!",
            })
        } catch (error) {
            console.error(error)
            toast.error("Analysis Failed", {
                description: error instanceof Error ? error.message : "Something went wrong",
            })
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <>
            <Button
                onClick={handleAnalyze}
                disabled={isLoading}
                variant={variant}
                className={`gap-2 ${variant === 'outline' ? 'bg-gradient-to-r from-blue-500/10 to-blue-500/10 hover:from-blue-500/20 hover:to-blue-500/20 border-blue-200/50 dark:border-blue-800/50' : ''}`}
            >
                {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                    <Sparkles className="w-4 h-4 text-blue-500" />
                )}
                {isLoading ? "Analyzing..." : (categoryId ? "Analyze This Category" : "Analyze My Taste")}
            </Button>

            <TasteReportModal
                isOpen={isOpen}
                onOpenChange={setIsOpen}
                data={data}
                categoryId={categoryId}
            />
        </>
    )
}
