'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Brain, Sparkles, Binary, Search, FileText } from 'lucide-react'

const LOADING_STEPS = [
    { text: "Analyzing ranking patterns...", icon: Search },
    { text: "Comparing against tropes...", icon: Binary },
    { text: "Generating archetypes...", icon: Brain },
    { text: "Curating recommendations...", icon: Sparkles },
    { text: "Finalizing report...", icon: FileText }
]

export function AnalysisLoadingState() {
    const [currentStep, setCurrentStep] = useState(0)

    useEffect(() => {
        const interval = setInterval(() => {
            setCurrentStep((prev) => (prev + 1) % LOADING_STEPS.length)
        }, 2500)

        return () => clearInterval(interval)
    }, [])

    const CurrentIcon = LOADING_STEPS[currentStep].icon

    return (
        <div className="flex flex-col items-center justify-center min-h-[400px] w-full p-8 text-center space-y-8">
            {/* Visual Pulse Effect */}
            <div className="relative">
                <div className="absolute inset-0 bg-blue-500/20 blur-xl rounded-full animate-pulse" />
                <div className="relative h-24 w-24 rounded-full bg-zinc-900 border border-white/10 flex items-center justify-center shadow-2xl">
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={currentStep}
                            initial={{ opacity: 0, scale: 0.5 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.5 }}
                            transition={{ duration: 0.3 }}
                        >
                            <CurrentIcon className="h-10 w-10 text-blue-400" />
                        </motion.div>
                    </AnimatePresence>
                </div>

                {/* Orbiting particles */}
                <div className="absolute inset-0 animate-spin-slow pointer-events-none">
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-2 h-2 w-2 bg-blue-400 rounded-full blur-[1px]" />
                </div>
            </div>

            {/* Cycling Text */}
            <div className="space-y-4 max-w-sm">
                <div className="h-8 relative overflow-hidden">
                    <AnimatePresence mode="wait">
                        <motion.p
                            key={currentStep}
                            initial={{ y: 20, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            exit={{ y: -20, opacity: 0 }}
                            transition={{ duration: 0.5 }}
                            className="text-lg font-medium text-zinc-200"
                        >
                            {LOADING_STEPS[currentStep].text}
                        </motion.p>
                    </AnimatePresence>
                </div>

                {/* Progress Bar */}
                <div className="h-1 w-full bg-zinc-800 rounded-full overflow-hidden">
                    <motion.div
                        className="h-full bg-blue-500"
                        initial={{ width: "0%" }}
                        animate={{ width: "100%" }}
                        transition={{
                            duration: LOADING_STEPS.length * 2.5,
                            ease: "linear",
                            repeat: Infinity
                        }}
                    />
                </div>
                <p className="text-xs text-zinc-500 animate-pulse">
                    This might take a few moments...
                </p>
            </div>
        </div>
    )
}
