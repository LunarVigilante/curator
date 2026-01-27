'use client'

import { useState, useEffect } from 'react'

/**
 * Hook to detect Global Privacy Control (GPC) signal
 * Required by CCPA/CPRA 2026 regulations
 * 
 * @returns {boolean | null} - true if GPC enabled, false if disabled, null if not supported
 */
export function useGlobalPrivacyControl(): boolean | null {
    const [gpcEnabled, setGpcEnabled] = useState<boolean | null>(null)

    useEffect(() => {
        // Check for GPC signal
        // @ts-expect-error - globalPrivacyControl is not in TypeScript types yet
        const gpc = navigator.globalPrivacyControl

        if (typeof gpc === 'boolean') {
            setGpcEnabled(gpc)
        } else if (typeof gpc === 'string') {
            setGpcEnabled(gpc === '1' || gpc === 'true')
        } else {
            setGpcEnabled(null) // Not supported
        }
    }, [])

    return gpcEnabled
}

/**
 * Check if user has opted out via any mechanism
 * Combines GPC signal with local consent state
 */
export function usePrivacyOptOut(): {
    isOptedOut: boolean
    source: 'gpc' | 'consent' | 'none'
} {
    const gpcEnabled = useGlobalPrivacyControl()
    const [consentOptOut, setConsentOptOut] = useState(false)

    useEffect(() => {
        // Check localStorage for previous opt-out
        const consent = localStorage.getItem('curator_privacy_consent')
        if (consent === 'declined') {
            setConsentOptOut(true)
        }
    }, [])

    // GPC takes precedence
    if (gpcEnabled === true) {
        return { isOptedOut: true, source: 'gpc' }
    }

    if (consentOptOut) {
        return { isOptedOut: true, source: 'consent' }
    }

    return { isOptedOut: false, source: 'none' }
}
