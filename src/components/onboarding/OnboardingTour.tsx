'use client'

import { useEffect, useState } from 'react'
import { driver, type DriveStep } from 'driver.js'
import 'driver.js/dist/driver.css'
import { hasCompletedTour, markTourCompleted } from '@/lib/actions/onboarding-tour'

const TOUR_COMPLETED_KEY = 'curator_tour_completed'

interface OnboardingTourProps {
    forceStart?: boolean
    onComplete?: () => void
}

// Tour step definitions
const TOUR_STEPS: DriveStep[] = [
    {
        popover: {
            title: '👋 Welcome to Curator!',
            description: 'Let me show you around. This quick tour will help you get the most out of the app.',
            side: 'over',
            align: 'center',
        }
    },
    {
        element: '[data-tour="collections"]',
        popover: {
            title: '📚 Your Collections',
            description: 'This is where all your collections live. Each collection is a category of things you want to rank — movies, games, books, and more.',
            side: 'bottom',
            align: 'start',
        }
    },
    {
        element: '[data-tour="new-collection"]',
        popover: {
            title: '➕ Create a Collection',
            description: 'Click here to create your first collection. Pick a category that interests you!',
            side: 'bottom',
            align: 'start',
        }
    },
    {
        element: '[data-tour="checklist"]',
        popover: {
            title: '✅ Getting Started',
            description: 'Track your progress here! Complete these tasks to unlock all of Curator\'s features.',
            side: 'bottom',
            align: 'start',
        }
    },
    {
        element: '[data-tour="browse"]',
        popover: {
            title: '🔍 Browse Items',
            description: 'Explore our database to discover and add items to your collections.',
            side: 'bottom',
            align: 'start',
        }
    },
    {
        element: '[data-tour="leaderboards"]',
        popover: {
            title: '🏆 Leaderboards',
            description: 'See how items are ranked by our community, critics, and our hybrid Curator Score!',
            side: 'bottom',
            align: 'start',
        }
    },
    {
        popover: {
            title: '🚀 You\'re All Set!',
            description: 'Start by creating a collection and adding some items. Then use Face-Off tournaments to rank them! Have fun curating!',
            side: 'over',
            align: 'center',
        }
    },
]

/**
 * Check localStorage first for fast response, then verify with DB
 */
function hasLocalTourCompleted(): boolean {
    if (typeof window === 'undefined') return true
    return localStorage.getItem(TOUR_COMPLETED_KEY) === 'true'
}

/**
 * Mark tour completed in both localStorage and DB
 */
function markLocalTourCompleted(): void {
    if (typeof window !== 'undefined') {
        localStorage.setItem(TOUR_COMPLETED_KEY, 'true')
    }
}

export default function OnboardingTour({ forceStart = false, onComplete }: OnboardingTourProps) {
    const [shouldShowTour, setShouldShowTour] = useState(false)

    useEffect(() => {
        // Force start bypasses all checks
        if (forceStart) {
            setShouldShowTour(true)
            return
        }

        // Fast check: localStorage (prevents flicker on client navigation)
        if (hasLocalTourCompleted()) {
            return
        }

        // Slower check: DB (handles first visit / cross-device)
        let cancelled = false
        hasCompletedTour().then((completed) => {
            if (cancelled) return

            if (completed) {
                // Sync localStorage with DB state
                markLocalTourCompleted()
            } else {
                setShouldShowTour(true)
            }
        })

        return () => { cancelled = true }
    }, [forceStart])

    useEffect(() => {
        if (!shouldShowTour) return

        // Small delay to ensure DOM elements are mounted
        const timeout = setTimeout(() => {
            // Mark completed immediately (prevents race conditions)
            markLocalTourCompleted()

            const driverInstance = driver({
                showProgress: true,
                animate: true,
                allowClose: true,
                overlayColor: 'rgba(0, 0, 0, 0.75)',
                stagePadding: 8,
                stageRadius: 8,
                popoverClass: 'curator-tour-popover',
                progressText: '{{current}} of {{total}}',
                nextBtnText: 'Next →',
                prevBtnText: '← Back',
                doneBtnText: 'Get Started!',
                steps: TOUR_STEPS,
                onDestroyed: async () => {
                    // Persist to DB (for cross-device)
                    await markTourCompleted()
                    onComplete?.()
                },
            })

            driverInstance.drive()
        }, 500)

        return () => clearTimeout(timeout)
    }, [shouldShowTour, onComplete])

    return null // This component doesn't render anything visible
}

/**
 * Hook to manually start the tour
 */
export function useOnboardingTour() {
    const [isActive, setIsActive] = useState(false)

    const startTour = () => {
        setIsActive(true)
    }

    const TourComponent = isActive ? (
        <OnboardingTour
            forceStart={true}
            onComplete={() => setIsActive(false)}
        />
    ) : null

    return { startTour, TourComponent }
}
