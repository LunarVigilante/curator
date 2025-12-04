'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { AlertTriangle } from 'lucide-react'

export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string }
    reset: () => void
}) {
    useEffect(() => {
        console.error(error)
    }, [error])

    return (
        <div className="container mx-auto py-20 flex flex-col items-center justify-center text-center space-y-4">
            <div className="bg-red-500/10 p-4 rounded-full">
                <AlertTriangle className="h-10 w-10 text-red-500" />
            </div>
            <h2 className="text-2xl font-bold">Something went wrong!</h2>
            <p className="text-muted-foreground max-w-md">
                We encountered an unexpected error. Please try again later.
            </p>
            <Button onClick={() => reset()} variant="default">
                Try again
            </Button>
        </div>
    )
}
