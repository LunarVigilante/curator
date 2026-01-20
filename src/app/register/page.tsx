'use client'

import { useActionState, useState } from 'react'
import { register } from '@/lib/actions/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import Link from 'next/link'
import { Check, Loader2, Eye, EyeOff } from 'lucide-react'

export default function RegisterPage() {
    const [state, dispatch, isPending] = useActionState(register, undefined)
    const [inviteCode, setInviteCode] = useState('')
    const [isVerifying, setIsVerifying] = useState(false)
    const [verifyStatus, setVerifyStatus] = useState<'idle' | 'valid' | 'invalid'>('idle')
    const [verifyMessage, setVerifyMessage] = useState('')
    const [showPassword, setShowPassword] = useState(false)

    const checkInvite = async () => {
        if (!inviteCode) return
        setIsVerifying(true)
        setVerifyStatus('idle')
        try {
            const res = await fetch(`/api/invites/check?code=${inviteCode}`)
            const data = await res.json()
            if (data.valid) {
                setVerifyStatus('valid')
                setVerifyMessage('Code is valid!')
            } else {
                setVerifyStatus('invalid')
                setVerifyMessage(data.message)
            }
        } catch {
            setVerifyStatus('invalid')
            setVerifyMessage('Error checking code')
        } finally {
            setIsVerifying(false)
        }
    }

    return (
        <div className="flex items-center justify-center min-h-screen w-full p-4 relative z-10">
            {/* Note: AntigravityBackground is in layout.tsx, so we just rely on z-index */}
            <Card className="w-full max-w-md bg-black/40 backdrop-blur-xl border-white/10 shadow-2xl relative z-20">
                <CardHeader className="space-y-2 pb-8 pt-10 px-8">
                    <CardTitle className="font-serif font-bold text-3xl tracking-tight text-white">Create Account</CardTitle>
                    <CardDescription className="text-sm text-zinc-400 font-medium tracking-wide">
                        Join Curator to start ranking items. Invite code required.
                    </CardDescription>
                </CardHeader>
                <form action={dispatch}>
                    <CardContent className="space-y-6 px-8">
                        {/* Invite Code - Required Enforcer */}
                        <div className="space-y-2">
                            <Label htmlFor="inviteCode" className="text-zinc-300">Invite Code</Label>
                            <div className="flex gap-2">
                                <Input
                                    id="inviteCode"
                                    name="inviteCode"
                                    placeholder="8-char code"
                                    required
                                    value={inviteCode}
                                    onChange={(e) => {
                                        setInviteCode(e.target.value.toUpperCase())
                                        setVerifyStatus('idle')
                                    }}
                                    className={`bg-zinc-900/50 border-white/10 text-white placeholder:text-zinc-500 uppercase font-mono transition-all focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 ${verifyStatus === 'valid' ? 'border-green-500/50 focus-visible:ring-green-500/30' :
                                        verifyStatus === 'invalid' ? 'border-red-500/50 focus-visible:ring-red-500/30' : ''
                                        }`}
                                />
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={checkInvite}
                                    disabled={!inviteCode || isVerifying || verifyStatus === 'valid'}
                                    className="shrink-0 bg-transparent border-white/10 text-zinc-300 hover:text-white hover:bg-white/5"
                                >
                                    {isVerifying ? <Loader2 className="h-4 w-4 animate-spin" /> :
                                        verifyStatus === 'valid' ? <Check className="h-4 w-4 text-green-500" /> : 'Verify'}
                                </Button>
                            </div>
                            {verifyStatus === 'valid' && <p className="text-xs text-green-500">{verifyMessage}</p>}
                            {verifyStatus === 'invalid' && <p className="text-xs text-red-500">{verifyMessage}</p>}
                            {state?.errors?.inviteCode && (
                                <p className="text-sm text-red-500">{state.errors.inviteCode}</p>
                            )}
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="email" className="text-zinc-300">Email</Label>
                            <Input
                                id="email"
                                name="email"
                                type="email"
                                placeholder="user@example.com"
                                required
                                className="bg-zinc-900/50 border-white/10 text-white placeholder:text-zinc-500 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="username" className="text-zinc-300">Display Name</Label>
                            <Input
                                id="username"
                                name="username"
                                placeholder="John Doe"
                                required
                                className="bg-zinc-900/50 border-white/10 text-white placeholder:text-zinc-500 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="password" className="text-zinc-300">Password</Label>
                            <div className="relative">
                                <Input
                                    id="password"
                                    name="password"
                                    type={showPassword ? "text" : "password"}
                                    required
                                    minLength={6}
                                    className="bg-zinc-900/50 border-white/10 text-white placeholder:text-zinc-500 pr-10 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white transition-colors rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50"
                                    aria-label={showPassword ? "Hide password" : "Show password"}
                                >
                                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                        </div>

                        {state?.message && (
                            <div className="p-3 rounded-md bg-red-500/10 border border-red-500/20 text-sm text-red-400">
                                {state.message}
                            </div>
                        )}
                    </CardContent>
                    <CardFooter className="flex flex-col gap-6 px-8 pb-10 pt-2">
                        <Button
                            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium py-6 transition-all shadow-lg hover:shadow-blue-500/20 mt-2"
                            disabled={isPending}
                        >
                            {isPending ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Creating account...
                                </>
                            ) : 'Create Account'}
                        </Button>
                        <div className="text-sm text-zinc-500 text-center">
                            Already have an account? <Link href="/login" className="text-blue-400 hover:text-blue-300 hover:underline transition-colors">Login</Link>
                        </div>
                    </CardFooter>
                </form>
            </Card>
        </div>
    )
}
