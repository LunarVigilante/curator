'use client'

import { useState, useCallback, useSyncExternalStore } from 'react'
import { X } from 'lucide-react'
import { useGlobalPrivacyControl } from '@/lib/hooks/useGlobalPrivacyControl'

const CONSENT_KEY = 'curator_privacy_consent'
const CONSENT_TIMESTAMP_KEY = 'curator_privacy_consent_timestamp'

type ConsentState = 'pending' | 'accepted' | 'declined'

/**
 * Save consent to localStorage
 */
function saveConsent(state: ConsentState): void {
    localStorage.setItem(CONSENT_KEY, state)
    localStorage.setItem(CONSENT_TIMESTAMP_KEY, new Date().toISOString())
}

/**
 * Get stored consent from localStorage
 */
function getStoredConsentSnapshot(): ConsentState | null {
    if (typeof localStorage === 'undefined') return null
    return localStorage.getItem(CONSENT_KEY) as ConsentState | null
}

function getStoredConsentServerSnapshot(): ConsentState | null {
    return null
}

function subscribeToStoredConsent(callback: () => void): () => void {
    window.addEventListener('storage', callback)
    return () => window.removeEventListener('storage', callback)
}

/**
 * CCPA/CPRA 2026 Compliant Consent Banner
 * 
 * Features:
 * - Symmetry in Choice: Accept/Decline buttons have equal prominence
 * - GPC Signal Detection: Honors navigator.globalPrivacyControl
 * - Opt-Out Confirmation: Shows confirmation when user declines
 * - No Dark Patterns: No manipulative language or hidden options
 */
export function ConsentBanner() {
    const [showBanner, setShowBanner] = useState(false)
    const [showConfirmation, setShowConfirmation] = useState(false)
    const gpcEnabled = useGlobalPrivacyControl()

    // Use useSyncExternalStore to read localStorage without causing cascading renders
    const storedConsent = useSyncExternalStore(
        subscribeToStoredConsent,
        getStoredConsentSnapshot,
        getStoredConsentServerSnapshot
    )

    // Determine if banner should show (computed, not stored in state)
    const shouldShowBanner = !storedConsent && gpcEnabled !== true && !showConfirmation

    // Show banner after delay on initial mount if no consent stored
    useState(() => {
        if (typeof window === 'undefined') return
        if (storedConsent || gpcEnabled === true) return

        const timer = setTimeout(() => setShowBanner(true), 1000)
        return () => clearTimeout(timer)
    })

    // Auto-decline for GPC users (save to localStorage, no state update needed)
    if (gpcEnabled === true && !storedConsent) {
        saveConsent('declined')
    }

    const handleAccept = useCallback(() => {
        saveConsent('accepted')
        setShowBanner(false)
    }, [])

    const handleDecline = useCallback(() => {
        saveConsent('declined')
        setShowBanner(false)
        setShowConfirmation(true)

        // Hide confirmation after 5 seconds
        setTimeout(() => setShowConfirmation(false), 5000)
    }, [])

    // Opt-Out Confirmation (required by 2026 regulations)
    if (showConfirmation) {
        return (
            <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:max-w-md z-50">
                <div className="bg-green-900/90 backdrop-blur-sm border border-green-700 rounded-lg p-4 shadow-xl">
                    <div className="flex items-center gap-3">
                        <div className="flex-shrink-0 w-8 h-8 bg-green-500/20 rounded-full flex items-center justify-center">
                            <svg className="w-5 h-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                        </div>
                        <div>
                            <p className="text-green-100 font-medium">Opt-Out Request Honored</p>
                            <p className="text-green-300 text-sm">Your privacy preferences have been saved.</p>
                        </div>
                        <button
                            onClick={() => setShowConfirmation(false)}
                            className="ml-auto text-green-400 hover:text-green-200"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            </div>
        )
    }

    if (!showBanner || !shouldShowBanner) return null

    return (
        <div className="fixed bottom-0 left-0 right-0 z-50 p-4 md:p-6">
            <div className="max-w-4xl mx-auto bg-zinc-900/95 backdrop-blur-md border border-zinc-700 rounded-xl shadow-2xl">
                <div className="p-6">
                    {/* Header */}
                    <div className="flex items-start justify-between gap-4 mb-4">
                        <div>
                            <h2 className="text-lg font-semibold text-white">
                                Privacy & Cookies
                            </h2>
                            <p className="text-zinc-400 text-sm mt-1">
                                California Consumer Privacy Act (CCPA/CPRA) Notice
                            </p>
                        </div>
                    </div>

                    {/* Content */}
                    <div className="text-zinc-300 text-sm space-y-3 mb-6">
                        <p>
                            We use cookies and similar technologies to improve your experience,
                            analyze usage, and personalize content. We also use AI-powered features
                            for content recommendations.
                        </p>
                        <p>
                            Under California law, you have the right to opt out of the sale or
                            sharing of your personal information, including for behavioral advertising.
                        </p>
                        <a
                            href="/privacy"
                            className="text-blue-400 hover:text-blue-300 underline inline-block"
                        >
                            Read our Privacy Policy
                        </a>
                    </div>

                    {/* Buttons - Equal Prominence (Symmetry in Choice) */}
                    <div className="flex flex-col sm:flex-row gap-3">
                        <button
                            onClick={handleDecline}
                            className="flex-1 px-6 py-3 bg-zinc-700 hover:bg-zinc-600 text-white font-medium rounded-lg transition-colors border border-zinc-600"
                        >
                            Decline All
                        </button>
                        <button
                            onClick={handleAccept}
                            className="flex-1 px-6 py-3 bg-zinc-700 hover:bg-zinc-600 text-white font-medium rounded-lg transition-colors border border-zinc-600"
                        >
                            Accept All
                        </button>
                    </div>

                    {/* GPC Notice */}
                    {gpcEnabled && (
                        <p className="text-xs text-zinc-500 mt-4 text-center">
                            🔒 Global Privacy Control signal detected and will be honored.
                        </p>
                    )}
                </div>
            </div>
        </div>
    )
}
