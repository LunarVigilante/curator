'use client'

import { useState, useTransition } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { ChevronRight, Sparkles } from 'lucide-react'
import Image from 'next/image'
import {
    CALIBRATION_QUESTIONS,
    type CalibrationAnswer,
    type CalibrationQuestion
} from '@/lib/types/onboarding'
import { saveCalibrationAnswers } from '@/lib/actions/onboarding'
import { toast } from 'sonner'

interface TasteCalibrationWizardProps {
    onComplete: () => void
}

export function TasteCalibrationWizard({ onComplete }: TasteCalibrationWizardProps) {
    const [currentStep, setCurrentStep] = useState(0)
    const [answers, setAnswers] = useState<CalibrationAnswer[]>([])
    const [isPending, startTransition] = useTransition()
    const [selectedValue, setSelectedValue] = useState<string | null>(null)

    const currentQuestion = CALIBRATION_QUESTIONS[currentStep]
    const isLastStep = currentStep === CALIBRATION_QUESTIONS.length - 1

    const handleSelect = (value: string) => {
        setSelectedValue(value)
    }

    const handleNext = () => {
        if (!selectedValue) return

        const newAnswers = [...answers, {
            questionId: currentQuestion.id,
            selectedValue
        }]
        setAnswers(newAnswers)

        if (isLastStep) {
            // Submit and complete
            startTransition(async () => {
                try {
                    const result = await saveCalibrationAnswers(newAnswers)
                    if (result.success) {
                        toast.success(`Created ${result.templates.length} collections for you!`)
                        onComplete()
                    } else {
                        toast.error('Something went wrong')
                    }
                } catch (error) {
                    toast.error('Failed to save preferences')
                }
            })
        } else {
            setCurrentStep(prev => prev + 1)
            setSelectedValue(null)
        }
    }

    return (
        <div className="min-h-screen bg-black flex flex-col items-center justify-center p-8">
            {/* Progress */}
            <div className="absolute top-8 left-8 right-8">
                <div className="flex items-center justify-center gap-3 mb-8">
                    {CALIBRATION_QUESTIONS.map((_, i) => (
                        <div
                            key={i}
                            className={`h-1.5 w-16 rounded-full transition-colors ${i <= currentStep ? 'bg-white' : 'bg-white/20'
                                }`}
                        />
                    ))}
                </div>
            </div>

            {/* Question */}
            <AnimatePresence mode="wait">
                <motion.div
                    key={currentStep}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="text-center mb-12"
                >
                    <h2 className="text-4xl md:text-5xl font-black text-white mb-4">
                        {currentQuestion.prompt}
                    </h2>
                    <p className="text-zinc-400 text-lg">
                        Step {currentStep + 1} of {CALIBRATION_QUESTIONS.length}
                    </p>
                </motion.div>
            </AnimatePresence>

            {/* Options */}
            <div className="flex flex-col md:flex-row gap-6 w-full max-w-4xl">
                <OptionCard
                    option={currentQuestion.optionA}
                    isSelected={selectedValue === currentQuestion.optionA.value}
                    onClick={() => handleSelect(currentQuestion.optionA.value)}
                />

                <div className="flex items-center justify-center">
                    <span className="text-2xl font-bold text-zinc-600">OR</span>
                </div>

                <OptionCard
                    option={currentQuestion.optionB}
                    isSelected={selectedValue === currentQuestion.optionB.value}
                    onClick={() => handleSelect(currentQuestion.optionB.value)}
                />
            </div>

            {/* Next Button */}
            <motion.div
                className="mt-12"
                initial={{ opacity: 0 }}
                animate={{ opacity: selectedValue ? 1 : 0.3 }}
            >
                <Button
                    size="lg"
                    onClick={handleNext}
                    disabled={!selectedValue || isPending}
                    className="bg-white text-black hover:bg-zinc-200 px-8 py-6 text-lg font-bold rounded-full"
                >
                    {isPending ? (
                        'Creating your collections...'
                    ) : isLastStep ? (
                        <>
                            <Sparkles className="w-5 h-5 mr-2" />
                            Let's Go!
                        </>
                    ) : (
                        <>
                            Next
                            <ChevronRight className="w-5 h-5 ml-2" />
                        </>
                    )}
                </Button>
            </motion.div>
        </div>
    )
}

function OptionCard({
    option,
    isSelected,
    onClick
}: {
    option: { label: string; value: string; emoji: string; imageUrl?: string }
    isSelected: boolean
    onClick: () => void
}) {
    return (
        <motion.button
            onClick={onClick}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className={`
                relative flex-1 aspect-[3/4] md:aspect-[4/5] rounded-3xl overflow-hidden 
                border-4 transition-all duration-300 cursor-pointer
                ${isSelected
                    ? 'border-white shadow-[0_0_40px_rgba(255,255,255,0.3)]'
                    : 'border-white/10 hover:border-white/30'
                }
            `}
        >
            {/* Background Image */}
            {option.imageUrl ? (
                <Image
                    src={option.imageUrl}
                    alt={option.label}
                    fill
                    className="object-cover"
                />
            ) : (
                <div className="absolute inset-0 bg-gradient-to-br from-zinc-800 to-zinc-900" />
            )}

            {/* Overlay */}
            <div className={`
                absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent
                transition-opacity
                ${isSelected ? 'opacity-60' : 'opacity-80'}
            `} />

            {/* Content */}
            <div className="absolute inset-0 flex flex-col items-center justify-end p-8">
                <span className="text-6xl mb-4">{option.emoji}</span>
                <h3 className="text-3xl font-bold text-white">{option.label}</h3>

                {isSelected && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="mt-4 bg-white text-black px-6 py-2 rounded-full font-bold text-sm"
                    >
                        Selected ✓
                    </motion.div>
                )}
            </div>
        </motion.button>
    )
}
