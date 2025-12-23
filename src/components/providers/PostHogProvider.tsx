'use client';
import posthog from 'posthog-js'
import { PostHogProvider as PHProvider } from 'posthog-js/react'
import { useEffect } from 'react'

export function PostHogProvider({ children, apiKey, apiHost }: { children: React.ReactNode, apiKey?: string, apiHost?: string }) {
    useEffect(() => {
        if (apiKey && apiHost) {
            posthog.init(apiKey, {
                api_host: apiHost,
                person_profiles: 'identified_only',
                session_recording: {
                    maskAllInputs: true,
                    maskTextSelector: ".sensitive"
                }
            })
        }
    }, [apiKey, apiHost])

    return <PHProvider client={posthog}>{children}</PHProvider>
}
