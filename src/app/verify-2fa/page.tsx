'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { sendEmailOTP, verifyEmailOTP } from '@/lib/actions/twoFactor'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Shield, Loader2, CheckCircle2, RefreshCw, AlertCircle } from 'lucide-react'

export default function Verify2FAPage() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const partialToken = searchParams.get('token')
    const method = searchParams.get('method') || 'email'

    const [code, setCode] = useState('')
    const [isVerifying, setIsVerifying] = useState(false)
    const [isSending, setIsSending] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState(false)
    const [cooldown, setCooldown] = useState(0)
    const [attemptsRemaining, setAttemptsRemaining] = useState<number | null>(null)
    const [codeSent, setCodeSent] = useState(false)

    // Handle cooldown timer
    useEffect(() => {
        if (cooldown > 0) {
            const timer = setTimeout(() => setCooldown(cooldown - 1), 1000)
            return () => clearTimeout(timer)
        }
    }, [cooldown])

    // Send initial code on mount for email 2FA
    const sendCode = useCallback(async () => {
        if (!partialToken || isSending || cooldown > 0) return

        setIsSending(true)
        setError(null)

        const result = await sendEmailOTP(partialToken)

        if (result.success) {
            setCodeSent(true)
        } else {
            setError(result.error || 'Failed to send code')
            if (result.cooldownRemaining) {
                setCooldown(result.cooldownRemaining)
            }
        }

        setIsSending(false)
    }, [partialToken, isSending, cooldown])

    useEffect(() => {
        if (method === 'email' && partialToken && !codeSent) {
            sendCode()
        }
    }, [method, partialToken, codeSent, sendCode])

    // Handle code verification
    const handleVerify = async (e: React.FormEvent) => {
        e.preventDefault()

        if (!partialToken || code.length !== 6) {
            setError('Please enter a 6-digit code')
            return
        }

        setIsVerifying(true)
        setError(null)

        const result = await verifyEmailOTP(partialToken, code)

        if (result.success) {
            setSuccess(true)
            // The server action should have created a full session
            // Redirect to home after a brief delay
            setTimeout(() => {
                router.push('/')
                router.refresh()
            }, 1500)
        } else {
            setError(result.error || 'Verification failed')
            if (result.attemptsRemaining !== undefined) {
                setAttemptsRemaining(result.attemptsRemaining)
            }
        }

        setIsVerifying(false)
    }

    // Handle resend
    const handleResend = async () => {
        setCode('')
        setAttemptsRemaining(null)
        await sendCode()
    }

    // No token provided
    if (!partialToken) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950 p-4">
                <Card className="w-full max-w-md border-white/10 bg-black/40 backdrop-blur-xl shadow-2xl">
                    <CardContent className="pt-8 pb-8 text-center space-y-4">
                        <AlertCircle className="w-12 h-12 text-red-500 mx-auto" />
                        <h2 className="text-xl font-bold text-white">Invalid Session</h2>
                        <p className="text-zinc-400">This verification link is invalid or has expired.</p>
                        <Button onClick={() => router.push('/login')} className="mt-4">
                            Return to Login
                        </Button>
                    </CardContent>
                </Card>
            </div>
        )
    }

    // Success state
    if (success) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950 p-4">
                <Card className="w-full max-w-md border-white/10 bg-black/40 backdrop-blur-xl shadow-2xl text-center">
                    <CardContent className="pt-8 pb-8 space-y-4">
                        <div className="mx-auto w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center">
                            <CheckCircle2 className="w-8 h-8 text-green-500" />
                        </div>
                        <h2 className="text-xl font-bold text-white">Verified!</h2>
                        <p className="text-zinc-400">Signing you in...</p>
                    </CardContent>
                </Card>
            </div>
        )
    }

    return (
        <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950 p-4">
            <Card className="w-full max-w-md border-white/10 bg-black/40 backdrop-blur-xl shadow-2xl">
                <CardHeader className="text-center space-y-4">
                    <div className="mx-auto w-16 h-16 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg">
                        <Shield className="w-8 h-8 text-white" />
                    </div>
                    <div>
                        <CardTitle className="text-2xl font-bold">Two-Factor Authentication</CardTitle>
                        <CardDescription className="text-zinc-400 mt-2">
                            {method === 'email'
                                ? 'Enter the 6-digit code sent to your email'
                                : 'Enter the code from your authenticator app'
                            }
                        </CardDescription>
                    </div>
                </CardHeader>

                <form onSubmit={handleVerify}>
                    <CardContent className="space-y-4">
                        {isSending && (
                            <div className="flex items-center justify-center gap-2 text-zinc-400 py-4">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                <span>Sending verification code...</span>
                            </div>
                        )}

                        {codeSent && !isSending && (
                            <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-sm text-blue-300">
                                A verification code has been sent to your email.
                            </div>
                        )}

                        <div className="space-y-2">
                            <Input
                                type="text"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                maxLength={6}
                                placeholder="000000"
                                value={code}
                                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                                className="bg-white/5 border-white/10 text-center text-3xl tracking-[0.5em] font-mono h-16"
                                autoFocus
                            />
                        </div>

                        {error && (
                            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-400">
                                {error}
                                {attemptsRemaining !== null && attemptsRemaining > 0 && (
                                    <span className="block mt-1 text-xs">
                                        {attemptsRemaining} attempt{attemptsRemaining !== 1 ? 's' : ''} remaining
                                    </span>
                                )}
                            </div>
                        )}
                    </CardContent>

                    <CardFooter className="flex flex-col gap-4">
                        <Button
                            type="submit"
                            className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500"
                            disabled={isVerifying || code.length !== 6}
                        >
                            {isVerifying ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Verifying...
                                </>
                            ) : (
                                'Verify & Sign In'
                            )}
                        </Button>

                        {method === 'email' && (
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={handleResend}
                                disabled={isSending || cooldown > 0}
                                className="text-zinc-400 hover:text-white"
                            >
                                {cooldown > 0 ? (
                                    `Resend code in ${cooldown}s`
                                ) : isSending ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <>
                                        <RefreshCw className="mr-2 h-4 w-4" />
                                        Resend Code
                                    </>
                                )}
                            </Button>
                        )}
                    </CardFooter>
                </form>
            </Card>
        </div>
    )
}
