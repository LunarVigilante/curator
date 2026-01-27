'use client'

import { useState } from 'react'
import { Loader2, ShieldCheck, AlertCircle } from 'lucide-react'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface ReauthDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    onConfirm: (password: string) => Promise<{ success: boolean; error?: string }>
    title?: string
    description?: string
    confirmLabel?: string
}

/**
 * Re-authentication Dialog for Sudo Mode
 * 
 * Prompts the user to enter their password before performing
 * sensitive actions like profile/email/password changes.
 */
export function ReauthDialog({
    open,
    onOpenChange,
    onConfirm,
    title = 'Verify Your Identity',
    description = 'Please enter your password to continue with this sensitive action.',
    confirmLabel = 'Confirm',
}: ReauthDialogProps) {
    const [password, setPassword] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError(null)
        setIsLoading(true)

        try {
            const result = await onConfirm(password)

            if (result.success) {
                setPassword('')
                onOpenChange(false)
            } else {
                setError(result.error || 'Verification failed')
            }
        } catch (err: any) {
            setError(err.message || 'An unexpected error occurred')
        } finally {
            setIsLoading(false)
        }
    }

    const handleClose = (newOpen: boolean) => {
        if (!isLoading) {
            setPassword('')
            setError(null)
            onOpenChange(newOpen)
        }
    }

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="sm:max-w-md bg-zinc-900 border-zinc-800">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-white">
                        <ShieldCheck className="w-5 h-5 text-amber-500" />
                        {title}
                    </DialogTitle>
                    <DialogDescription className="text-zinc-400">
                        {description}
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="reauth-password" className="text-zinc-300">
                            Current Password
                        </Label>
                        <Input
                            id="reauth-password"
                            type="password"
                            placeholder="Enter your password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="bg-zinc-950 border-zinc-700 text-white placeholder:text-zinc-500"
                            disabled={isLoading}
                            autoFocus
                            required
                        />
                    </div>

                    {error && (
                        <div className="flex items-center gap-2 p-3 bg-red-950/30 border border-red-900 rounded-lg text-red-400 text-sm">
                            <AlertCircle className="w-4 h-4 flex-shrink-0" />
                            {error}
                        </div>
                    )}

                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => handleClose(false)}
                            disabled={isLoading}
                            className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            disabled={isLoading || !password}
                            className="bg-amber-600 hover:bg-amber-700 text-white"
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Verifying...
                                </>
                            ) : (
                                confirmLabel
                            )}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
