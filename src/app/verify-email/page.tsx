'use client'

import { useActionState, useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { verifyEmailByCode, resendVerificationEmail } from '@/lib/actions/verification'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Mail, Loader2, CheckCircle2, RefreshCw } from 'lucide-react'
import Link from 'next/link'

export default function VerifyEmailPage() {
    const router = useRouter()
    const [state, dispatch, isPending] = useActionState(verifyEmailByCode, undefined)
    const [resendPending, startResendTransition] = useTransition()
    const [resendStatus, setResendStatus] = useState<'idle' | 'success' | 'error'>('idle')

    // Redirect on success
    useEffect(() => {
        if (state?.success) {
            setTimeout(() => {
                router.push('/')
            }, 2000)
        }
    }, [state?.success, router])

    const handleResend = () => {
        startResendTransition(async () => {
            const result = await resendVerificationEmail()
            setResendStatus(result.success ? 'success' : 'error')
            // Reset status after 3 seconds
            setTimeout(() => setResendStatus('idle'), 3000)
        })
    }

    if (state?.success) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950 p-4">
                <Card className="w-full max-w-md border-white/10 bg-black/40 backdrop-blur-xl shadow-2xl text-center">
                    <CardContent className="pt-8 pb-8 space-y-4">
                        <div className="mx-auto w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center">
                            <CheckCircle2 className="w-8 h-8 text-green-500" />
                        </div>
                        <h2 className="text-xl font-bold text-white">Email Verified!</h2>
                        <p className="text-zinc-400">Redirecting to dashboard...</p>
                    </CardContent>
                </Card>
            </div>
        )
    }

    return (
        <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950 p-4">
            <Card className="w-full max-w-md border-white/10 bg-black/40 backdrop-blur-xl shadow-2xl">
                <CardHeader className="text-center space-y-4">
                    <div className="mx-auto w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg">
                        <Mail className="w-8 h-8 text-white" />
                    </div>
                    <div>
                        <CardTitle className="text-2xl font-bold">Verify Your Email</CardTitle>
                        <CardDescription className="text-zinc-400 mt-2">
                            Enter the 6-digit code sent to your email
                        </CardDescription>
                    </div>
                </CardHeader>

                <form action={dispatch}>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="code">Verification Code</Label>
                            <Input
                                id="code"
                                name="code"
                                type="text"
                                inputMode="numeric"
                                pattern="[0-9]{6}"
                                maxLength={6}
                                placeholder="123456"
                                required
                                className="bg-white/5 border-white/10 text-center text-2xl tracking-widest font-mono"
                            />
                        </div>

                        {state?.error && (
                            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-400">
                                {state.error}
                            </div>
                        )}

                        {resendStatus === 'success' && (
                            <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-sm text-green-400">
                                Verification email sent!
                            </div>
                        )}
                    </CardContent>

                    <CardFooter className="flex flex-col gap-4">
                        <Button
                            className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500"
                            disabled={isPending}
                        >
                            {isPending ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Verifying...
                                </>
                            ) : (
                                'Verify Email'
                            )}
                        </Button>

                        <div className="flex items-center justify-between w-full text-sm">
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={handleResend}
                                disabled={resendPending}
                                className="text-zinc-400 hover:text-white"
                            >
                                {resendPending ? (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                ) : (
                                    <RefreshCw className="mr-2 h-4 w-4" />
                                )}
                                Resend Code
                            </Button>

                            <Link href="/login" className="text-zinc-400 hover:text-white">
                                Back to Login
                            </Link>
                        </div>
                    </CardFooter>
                </form>
            </Card>
        </div>
    )
}
