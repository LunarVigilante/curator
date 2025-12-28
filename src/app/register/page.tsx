'use client'

import { useActionState, useState } from 'react'
import { register } from '@/lib/actions/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import Link from 'next/link'
import { Check, Loader2 } from 'lucide-react'

export default function RegisterPage() {
    const [state, dispatch, isPending] = useActionState(register, undefined)
    const [inviteCode, setInviteCode] = useState('')
    const [isVerifying, setIsVerifying] = useState(false)
    const [verifyStatus, setVerifyStatus] = useState<'idle' | 'valid' | 'invalid'>('idle')
    const [verifyMessage, setVerifyMessage] = useState('')

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
        } catch (e) {
            setVerifyStatus('invalid')
            setVerifyMessage('Error checking code')
        } finally {
            setIsVerifying(false)
        }
    }

    return (
        <div className="flex items-center justify-center min-h-screen bg-background p-4">
            <Card className="w-full max-w-md border-white/10 bg-black/20 backdrop-blur-sm">
                <CardHeader>
                    <CardTitle className="text-2xl">Create Account</CardTitle>
                    <CardDescription>
                        Join Curator to start ranking items. Invite code required.
                    </CardDescription>
                </CardHeader>
                <form action={dispatch}>
                    <CardContent className="space-y-4">
                        {/* Invite Code - Required Enforcer */}
                        <div className="space-y-2">
                            <Label htmlFor="inviteCode">Invite Code</Label>
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
                                    className={`uppercase font-mono ${verifyStatus === 'valid' ? 'border-green-500/50 focus-visible:ring-green-500/30' :
                                            verifyStatus === 'invalid' ? 'border-red-500/50 focus-visible:ring-red-500/30' : ''
                                        }`}
                                />
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={checkInvite}
                                    disabled={!inviteCode || isVerifying || verifyStatus === 'valid'}
                                    className="shrink-0"
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
                            <Label htmlFor="email">Email</Label>
                            <Input id="email" name="email" type="email" placeholder="user@example.com" required />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="username">Display Name</Label>
                            <Input id="username" name="username" placeholder="John Doe" required />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="password">Password</Label>
                            <Input id="password" name="password" type="password" required minLength={6} />
                        </div>

                        {state?.message && (
                            <div className="p-3 rounded-md bg-red-500/10 border border-red-500/20 text-sm text-red-400">
                                {state.message}
                            </div>
                        )}
                    </CardContent>
                    <CardFooter className="flex flex-col gap-4">
                        <Button className="w-full" disabled={isPending}>
                            {isPending ? 'Creating account...' : 'Create Account'}
                        </Button>
                        <div className="text-sm text-muted-foreground text-center">
                            Already have an account? <Link href="/login" className="text-primary hover:underline">Login</Link>
                        </div>
                    </CardFooter>
                </form>
            </Card>
        </div>
    )
}
