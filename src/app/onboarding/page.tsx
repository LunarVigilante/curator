'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { TasteCalibrationWizard, BinaryRater } from '@/components/onboarding'
import { BINARY_RATER_PAIRS } from '@/lib/types/onboarding'

type OnboardingStep = 'calibration' | 'binary' | 'complete'

export default function OnboardingPage() {
    const router = useRouter()
    const [step, setStep] = useState<OnboardingStep>('calibration')

    // Pick a random binary rater pair for the "This or That" step
    const binaryPair = BINARY_RATER_PAIRS[Math.floor(Math.random() * BINARY_RATER_PAIRS.length)]

    const handleCalibrationComplete = () => {
        setStep('binary')
    }

    const handleBinaryComplete = () => {
        setStep('complete')
        // Redirect to dashboard after a brief moment
        setTimeout(() => {
            router.push('/')
        }, 500)
    }

    if (step === 'calibration') {
        return <TasteCalibrationWizard onComplete={handleCalibrationComplete} />
    }

    if (step === 'binary') {
        return <BinaryRater pair={binaryPair} onComplete={handleBinaryComplete} />
    }

    // Complete state - brief loading before redirect
    return (
        <div className="min-h-screen bg-black flex items-center justify-center">
            <div className="text-center">
                <div className="text-6xl mb-4">🎉</div>
                <h1 className="text-3xl font-bold text-white mb-2">You're All Set!</h1>
                <p className="text-zinc-400">Taking you to your dashboard...</p>
            </div>
        </div>
    )
}
