'use client'

import { useState, useEffect, useTransition } from 'react'
import {
    getUserTwoFactorStatus,
    enableEmailTwoFactor,
    disableEmailTwoFactor
} from '@/lib/actions/twoFactor'
import {
    generateTOTPSetup,
    verifyAndEnableTOTP,
    disableTOTP,
    getBackupCodeCount,
    regenerateBackupCodes,
} from '@/lib/actions/totp'
import {
    generatePasskeyRegistrationOptions,
    verifyPasskeyRegistration,
    getUserPasskeys,
    deletePasskey,
    renamePasskey,
} from '@/lib/actions/passkey'
import { startRegistration } from '@simplewebauthn/browser'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog'
import {
    Shield,
    Smartphone,
    Mail,
    Key,
    Loader2,
    CheckCircle2,
    AlertTriangle,
    Trash2,
    Plus,
    Copy,
    RefreshCw
} from 'lucide-react'

export default function SecuritySettingsPage() {
    // Status state
    const [status, setStatus] = useState<{
        totpEnabled: boolean
        emailEnabled: boolean
        hasPasskeys: boolean
    } | null>(null)
    const [passkeys, setPasskeys] = useState<any[]>([])
    const [backupCodeCount, setBackupCodeCount] = useState(0)
    const [isPending, startTransition] = useTransition()

    // TOTP setup state
    const [showTOTPSetup, setShowTOTPSetup] = useState(false)
    const [totpSecret, setTotpSecret] = useState('')
    const [totpQR, setTotpQR] = useState('')
    const [totpCode, setTotpCode] = useState('')
    const [backupCodes, setBackupCodes] = useState<string[]>([])

    // Passkey state
    const [showPasskeyAdd, setShowPasskeyAdd] = useState(false)
    const [passkeyName, setPasskeyName] = useState('')

    // General state
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState<string | null>(null)

    // Load initial data
    useEffect(() => {
        loadStatus()
    }, [])

    async function loadStatus() {
        startTransition(async () => {
            // We need the user ID - this is a simplified approach
            // In production, getUserTwoFactorStatus should work with session
            const [statusResult, passkeysResult, backupCount] = await Promise.all([
                // For now, just check passkeys existence
                getUserPasskeys(),
                getUserPasskeys(),
                getBackupCodeCount(),
            ])

            setPasskeys(passkeysResult)
            setBackupCodeCount(backupCount)

            // Simplified status - would need proper implementation
            setStatus({
                totpEnabled: backupCount > 0,
                emailEnabled: false, // Would need to fetch from user record
                hasPasskeys: passkeysResult.length > 0,
            })
        })
    }

    // ==========================================================================
    // EMAIL 2FA
    // ==========================================================================

    async function handleToggleEmail(enabled: boolean) {
        setError(null)
        startTransition(async () => {
            const result = enabled
                ? await enableEmailTwoFactor()
                : await disableEmailTwoFactor()

            if (result.success) {
                setSuccess(enabled ? 'Email 2FA enabled' : 'Email 2FA disabled')
                loadStatus()
            } else {
                setError(result.error || 'Failed to update')
            }
        })
    }

    // ==========================================================================
    // TOTP SETUP
    // ==========================================================================

    async function startTOTPSetup() {
        setError(null)
        setTotpCode('')
        setBackupCodes([])

        startTransition(async () => {
            const result = await generateTOTPSetup()

            if (result.success && result.secret && result.qrCode) {
                setTotpSecret(result.secret)
                setTotpQR(result.qrCode)
                setShowTOTPSetup(true)
            } else {
                setError(result.error || 'Failed to start setup')
            }
        })
    }

    async function completeTOTPSetup() {
        if (totpCode.length !== 6) {
            setError('Please enter a 6-digit code')
            return
        }

        setError(null)
        startTransition(async () => {
            const result = await verifyAndEnableTOTP(totpSecret, totpCode)

            if (result.success && result.backupCodes) {
                setBackupCodes(result.backupCodes)
                setSuccess('Authenticator app enabled!')
                loadStatus()
            } else {
                setError(result.error || 'Failed to verify')
            }
        })
    }

    async function handleDisableTOTP() {
        const code = prompt('Enter your authenticator code to disable 2FA:')
        if (!code) return

        startTransition(async () => {
            const result = await disableTOTP(code)

            if (result.success) {
                setSuccess('Authenticator app disabled')
                loadStatus()
            } else {
                setError(result.error || 'Failed to disable')
            }
        })
    }

    // ==========================================================================
    // PASSKEY
    // ==========================================================================

    async function addPasskey() {
        setError(null)

        startTransition(async () => {
            // Get registration options from server
            const optionsResult = await generatePasskeyRegistrationOptions()

            if (!optionsResult.success || !optionsResult.options) {
                setError(optionsResult.error || 'Failed to start registration')
                return
            }

            try {
                // Start WebAuthn registration ceremony
                const credential = await startRegistration(optionsResult.options)

                // Verify with server
                const verifyResult = await verifyPasskeyRegistration(
                    credential,
                    passkeyName || undefined
                )

                if (verifyResult.success) {
                    setSuccess('Passkey added successfully!')
                    setShowPasskeyAdd(false)
                    setPasskeyName('')
                    loadStatus()
                } else {
                    setError(verifyResult.error || 'Failed to add passkey')
                }
            } catch (err: any) {
                if (err.name === 'NotAllowedError') {
                    setError('Registration was cancelled')
                } else {
                    setError('Failed to register passkey: ' + err.message)
                }
            }
        })
    }

    async function handleDeletePasskey(id: string) {
        if (!confirm('Are you sure you want to remove this passkey?')) return

        startTransition(async () => {
            const result = await deletePasskey(id)

            if (result.success) {
                setSuccess('Passkey removed')
                loadStatus()
            } else {
                setError(result.error || 'Failed to remove')
            }
        })
    }

    // ==========================================================================
    // BACKUP CODES
    // ==========================================================================

    async function handleRegenerateCodes() {
        const code = prompt('Enter your authenticator code to regenerate backup codes:')
        if (!code) return

        startTransition(async () => {
            const result = await regenerateBackupCodes(code)

            if (result.success && result.backupCodes) {
                setBackupCodes(result.backupCodes)
                setSuccess('Backup codes regenerated!')
                loadStatus()
            } else {
                setError(result.error || 'Failed to regenerate')
            }
        })
    }

    function copyBackupCodes() {
        navigator.clipboard.writeText(backupCodes.join('\n'))
        setSuccess('Backup codes copied to clipboard!')
    }

    // ==========================================================================
    // RENDER
    // ==========================================================================

    return (
        <div className="container max-w-3xl py-8 space-y-8">
            <div>
                <h1 className="text-3xl font-bold">Security Settings</h1>
                <p className="text-muted-foreground mt-2">
                    Manage your account security and two-factor authentication
                </p>
            </div>

            {/* Status Messages */}
            {error && (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    {error}
                </div>
            )}
            {success && (
                <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4" />
                    {success}
                </div>
            )}

            {/* Authenticator App */}
            <Card className="border-white/10 bg-black/40">
                <CardHeader>
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-purple-500/20">
                            <Smartphone className="h-5 w-5 text-purple-400" />
                        </div>
                        <div>
                            <CardTitle>Authenticator App</CardTitle>
                            <CardDescription>
                                Use Google Authenticator, Authy, or similar apps
                            </CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    {status?.totpEnabled ? (
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-green-400">
                                <CheckCircle2 className="h-4 w-4" />
                                <span>Enabled</span>
                                <span className="text-muted-foreground text-sm">
                                    ({backupCodeCount} backup codes remaining)
                                </span>
                            </div>
                            <div className="flex gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleRegenerateCodes}
                                    disabled={isPending}
                                >
                                    <RefreshCw className="h-4 w-4 mr-2" />
                                    New Codes
                                </Button>
                                <Button
                                    variant="destructive"
                                    size="sm"
                                    onClick={handleDisableTOTP}
                                    disabled={isPending}
                                >
                                    Disable
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <Button onClick={startTOTPSetup} disabled={isPending}>
                            {isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                            Set Up Authenticator
                        </Button>
                    )}
                </CardContent>
            </Card>

            {/* Email 2FA */}
            <Card className="border-white/10 bg-black/40">
                <CardHeader>
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-blue-500/20">
                            <Mail className="h-5 w-5 text-blue-400" />
                        </div>
                        <div>
                            <CardTitle>Email Verification</CardTitle>
                            <CardDescription>
                                Receive a code via email when signing in
                            </CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center justify-between">
                        <Label htmlFor="email-2fa">Enable email verification</Label>
                        <Switch
                            id="email-2fa"
                            checked={status?.emailEnabled || false}
                            onCheckedChange={handleToggleEmail}
                            disabled={isPending}
                        />
                    </div>
                </CardContent>
            </Card>

            {/* Passkeys */}
            <Card className="border-white/10 bg-black/40">
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-green-500/20">
                                <Key className="h-5 w-5 text-green-400" />
                            </div>
                            <div>
                                <CardTitle>Passkeys</CardTitle>
                                <CardDescription>
                                    Use Face ID, Touch ID, or security keys
                                </CardDescription>
                            </div>
                        </div>
                        <Button size="sm" onClick={() => setShowPasskeyAdd(true)} disabled={isPending}>
                            <Plus className="h-4 w-4 mr-2" />
                            Add Passkey
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    {passkeys.length === 0 ? (
                        <p className="text-muted-foreground text-sm">
                            No passkeys registered. Add one for passwordless sign-in.
                        </p>
                    ) : (
                        <div className="space-y-3">
                            {passkeys.map((pk) => (
                                <div
                                    key={pk.id}
                                    className="flex items-center justify-between p-3 rounded-lg bg-white/5"
                                >
                                    <div>
                                        <p className="font-medium">{pk.name || 'Unnamed Passkey'}</p>
                                        <p className="text-xs text-muted-foreground">
                                            Added {new Date(pk.createdAt).toLocaleDateString()}
                                            {pk.lastUsedAt && ` • Last used ${new Date(pk.lastUsedAt).toLocaleDateString()}`}
                                        </p>
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleDeletePasskey(pk.id)}
                                        disabled={isPending}
                                    >
                                        <Trash2 className="h-4 w-4 text-red-400" />
                                    </Button>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* TOTP Setup Dialog */}
            <Dialog open={showTOTPSetup} onOpenChange={setShowTOTPSetup}>
                <DialogContent className="bg-zinc-900 border-zinc-800">
                    <DialogHeader>
                        <DialogTitle>Set Up Authenticator App</DialogTitle>
                        <DialogDescription>
                            Scan this QR code with your authenticator app
                        </DialogDescription>
                    </DialogHeader>

                    {backupCodes.length > 0 ? (
                        // Show backup codes after successful setup
                        <div className="space-y-4">
                            <div className="p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                                <p className="text-yellow-400 font-medium mb-2">
                                    Save your backup codes!
                                </p>
                                <p className="text-sm text-muted-foreground">
                                    Store these codes somewhere safe. You can use them if you lose access to your authenticator app.
                                </p>
                            </div>

                            <div className="grid grid-cols-2 gap-2 p-4 rounded-lg bg-black/40 font-mono text-sm">
                                {backupCodes.map((code, i) => (
                                    <div key={i}>{code}</div>
                                ))}
                            </div>

                            <Button onClick={copyBackupCodes} variant="outline" className="w-full">
                                <Copy className="h-4 w-4 mr-2" />
                                Copy Codes
                            </Button>

                            <DialogFooter>
                                <Button onClick={() => {
                                    setShowTOTPSetup(false)
                                    setBackupCodes([])
                                }}>
                                    Done
                                </Button>
                            </DialogFooter>
                        </div>
                    ) : (
                        // Show QR code for setup
                        <div className="space-y-4">
                            <div className="flex justify-center">
                                {totpQR && (
                                    <img
                                        src={totpQR}
                                        alt="QR Code"
                                        className="w-48 h-48 rounded-lg"
                                    />
                                )}
                            </div>

                            <div className="text-center">
                                <p className="text-xs text-muted-foreground mb-1">
                                    Or enter this code manually:
                                </p>
                                <code className="text-sm bg-black/40 px-3 py-1 rounded font-mono">
                                    {totpSecret}
                                </code>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="totp-code">Verification Code</Label>
                                <Input
                                    id="totp-code"
                                    type="text"
                                    inputMode="numeric"
                                    maxLength={6}
                                    placeholder="000000"
                                    value={totpCode}
                                    onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ''))}
                                    className="text-center text-2xl tracking-widest font-mono"
                                />
                            </div>

                            <DialogFooter>
                                <Button variant="outline" onClick={() => setShowTOTPSetup(false)}>
                                    Cancel
                                </Button>
                                <Button
                                    onClick={completeTOTPSetup}
                                    disabled={isPending || totpCode.length !== 6}
                                >
                                    {isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                                    Verify & Enable
                                </Button>
                            </DialogFooter>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* Add Passkey Dialog */}
            <Dialog open={showPasskeyAdd} onOpenChange={setShowPasskeyAdd}>
                <DialogContent className="bg-zinc-900 border-zinc-800">
                    <DialogHeader>
                        <DialogTitle>Add Passkey</DialogTitle>
                        <DialogDescription>
                            Use your device's biometrics or security key
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="passkey-name">Passkey Name (optional)</Label>
                            <Input
                                id="passkey-name"
                                placeholder="e.g., MacBook Pro, iPhone"
                                value={passkeyName}
                                onChange={(e) => setPasskeyName(e.target.value)}
                            />
                        </div>

                        <DialogFooter>
                            <Button variant="outline" onClick={() => setShowPasskeyAdd(false)}>
                                Cancel
                            </Button>
                            <Button onClick={addPasskey} disabled={isPending}>
                                {isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                                Register Passkey
                            </Button>
                        </DialogFooter>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    )
}
