import { useSyncExternalStore, useCallback } from "react"

export function useMediaQuery(query: string) {
    const subscribe = useCallback((callback: () => void) => {
        const media = window.matchMedia(query)
        media.addEventListener("change", callback)
        return () => media.removeEventListener("change", callback)
    }, [query])

    const getSnapshot = useCallback(() => {
        return window.matchMedia(query).matches
    }, [query])

    const getServerSnapshot = useCallback(() => {
        return false // Default to false on server
    }, [])

    return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
