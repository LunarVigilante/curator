'use client'

import { useSyncExternalStore } from 'react'

// Type declaration for Global Privacy Control
declare global {
    interface Navigator {
        globalPrivacyControl?: boolean | string
    }
}

/**
 * Get GPC value from navigator (works on server and client)
 */
function getGPCSnapshot(): boolean | null {
    if (typeof navigator === 'undefined') return null

    const gpc = navigator.globalPrivacyControl

    if (typeof gpc === 'boolean') {
        return gpc
    } else if (typeof gpc === 'string') {
        return gpc === '1' || gpc === 'true'
    }

    return null
}

function getGPCServerSnapshot(): boolean | null {
    return null
}

function subscribeToGPC(_callback: () => void): () => void {
    // GPC doesn't change during session, no need to subscribe
    return () => { }
}

/**
 * Hook to detect Global Privacy Control (GPC) signal
 * Required by CCPA/CPRA 2026 regulations
 * 
 * @returns {boolean | null} - true if GPC enabled, false if disabled, null if not supported
 */
export function useGlobalPrivacyControl(): boolean | null {
    return useSyncExternalStore(
        subscribeToGPC,
        getGPCSnapshot,
        getGPCServerSnapshot
    )
}

/**
 * Get consent opt-out status from localStorage
 */
function getConsentSnapshot(): boolean {
    if (typeof localStorage === 'undefined') return false
    return localStorage.getItem('curator_privacy_consent') === 'declined'
}

function getConsentServerSnapshot(): boolean {
    return false
}

function subscribeToConsent(callback: () => void): () => void {
    // Listen for storage changes (in case of cross-tab updates)
    window.addEventListener('storage', callback)
    return () => window.removeEventListener('storage', callback)
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
    const consentOptOut = useSyncExternalStore(
        subscribeToConsent,
        getConsentSnapshot,
        getConsentServerSnapshot
    )

    // GPC takes precedence
    if (gpcEnabled === true) {
        return { isOptedOut: true, source: 'gpc' }
    }

    if (consentOptOut) {
        return { isOptedOut: true, source: 'consent' }
    }

    return { isOptedOut: false, source: 'none' }
}
