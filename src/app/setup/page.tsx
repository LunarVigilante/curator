'use client'

import { useActionState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { completeSetup, isSetupRequired } from '@/lib/actions/setup'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Shield, Loader2 } from 'lucide-react'

export default function SetupPage() {
    const router = useRouter()
    const [state, dispatch, isPending] = useActionState(completeSetup, undefined)

    // Redirect on success
    useEffect(() => {
        if (state?.success) {
            router.push('/login?setup=complete')
        }
    }, [state?.success, router])

    // Check if setup is actually needed
    useEffect(() => {
        isSetupRequired().then(required => {
            if (!required) {
                router.push('/login')
            }
        })
    }, [router])

    return (
        <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950 p-4">
            <Card className="w-full max-w-md border-white/10 bg-black/40 backdrop-blur-xl shadow-2xl">
                <CardHeader className="text-center space-y-4">
                    <div className="mx-auto w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg">
                        <Shield className="w-8 h-8 text-white" />
                    </div>
                    <div>
                        <CardTitle className="text-2xl font-bold">Welcome to Curator</CardTitle>
                        <CardDescription className="text-zinc-400 mt-2">
                            Create your admin account to get started
                        </CardDescription>
                    </div>
                </CardHeader>

                <form action={dispatch}>
                    <CardContent className="space-y-4">
                        <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-sm text-blue-300">
                            <strong>First-time setup:</strong> This account will have full admin privileges.
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="email">Email</Label>
                            <Input
                                id="email"
                                name="email"
                                type="email"
                                placeholder="admin@example.com"
                                required
                                className="bg-white/5 border-white/10"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="name">Display Name</Label>
                            <Input
                                id="name"
                                name="name"
                                placeholder="Admin"
                                required
                                className="bg-white/5 border-white/10"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="password">Password</Label>
                            <Input
                                id="password"
                                name="password"
                                type="password"
                                required
                                minLength={8}
                                placeholder="••••••••"
                                className="bg-white/5 border-white/10"
                            />
                            <p className="text-xs text-zinc-500">Minimum 8 characters</p>
                        </div>

                        {state?.error && (
                            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-400">
                                {state.error}
                            </div>
                        )}
                    </CardContent>

                    <CardFooter>
                        <Button
                            className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500"
                            disabled={isPending}
                        >
                            {isPending ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Creating Admin Account...
                                </>
                            ) : (
                                'Create Admin Account'
                            )}
                        </Button>
                    </CardFooter>
                </form>
            </Card>
        </div>
    )
}
