'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Shield } from 'lucide-react'

export default function SecuritySettingsPage() {
    return (
        <div className="container max-w-3xl py-8 space-y-8">
            <div>
                <h1 className="text-3xl font-bold">Security Settings</h1>
                <p className="text-muted-foreground mt-2">
                    Manage your account security.
                </p>
            </div>

            <Card className="border-white/10 bg-black/40">
                <CardHeader>
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-green-500/20">
                            <Shield className="h-5 w-5 text-green-400" />
                        </div>
                        <div>
                            <CardTitle>Authentication</CardTitle>
                            <CardDescription>
                                Authentication is handled via Supabase.
                            </CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <p className="text-muted-foreground">
                        Your account security is managed by our authentication provider.
                    </p>
                </CardContent>
            </Card>
        </div>
    )
}
