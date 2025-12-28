'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { authClient } from '@/lib/auth-client';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Loader2, Trash2, KeyRound, AlertCircle, Monitor, Smartphone, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';

export default function ProfileSettings() {
    const [isLoading, setIsLoading] = useState(false);
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [sessions, setSessions] = useState<any[]>([]);
    const [currentSessionToken, setCurrentSessionToken] = useState<string | null>(null);
    const router = useRouter();

    // Fetch sessions on mount
    useEffect(() => {
        const fetchSessions = async () => {
            try {
                const result = await authClient.listSessions();
                if (result.data) {
                    setSessions(result.data);
                }
            } catch (err) {
                console.error('Failed to fetch sessions:', err);
            }
        };
        fetchSessions();

        // Get current session token from cookie (if available)
        // The current session will have isCurrent = true from the API
    }, []);

    const handleChangePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (newPassword !== confirmPassword) {
            toast.error('New passwords do not match');
            return;
        }

        setIsLoading(true);
        try {
            const res = await fetch('/api/auth/change-password', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    currentPassword,
                    newPassword,
                    revokeOtherSessions: true
                })
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.message || data.error?.message || 'Failed to update password');
            }

            // Success
            toast.success('Password changed successfully');
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
            router.refresh();
        } catch (err: any) {
            console.error(err);
            const msg = err.message || 'An error occurred';
            setError(msg);
            toast.error(msg);
        } finally {
            setIsLoading(false);
        }
    };

    // Placeholder for Delete Account - typically requires strict confirmation
    const handleDeleteAccount = async () => {
        if (!confirm("Are you SURE you want to delete your account? This action cannot be undone.")) return;

        // This usually requires a separate API or client function depending on configuration
        // For now, we'll just show a toast as it's a "Danger Zone" placeholder per request
        toast.error("Account deletion is disabled in this demo.");
    };

    const handleRevokeSession = async (token: string) => {
        try {
            await authClient.revokeSession({ token });
            setSessions(prev => prev.filter(s => s.token !== token));
            toast.success('Session revoked');
        } catch (err) {
            console.error('Failed to revoke session:', err);
            toast.error('Failed to revoke session');
        }
    };

    return (
        <div className="space-y-8">
            {/* Change Password Card */}
            <Card className="border-white/10 bg-black/20 backdrop-blur-sm">
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <KeyRound className="w-5 h-5 text-blue-400" />
                        <CardTitle>Security</CardTitle>
                    </div>
                    <CardDescription>
                        Update your password to keep your account secure.
                    </CardDescription>
                </CardHeader>
                <form onSubmit={handleChangePassword}>
                    <CardContent className="space-y-4">
                        {error && (
                            <div className="p-3 rounded-md bg-red-500/10 border border-red-500/20 flex items-center gap-2 text-sm text-red-200 animate-in fade-in slide-in-from-top-1">
                                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                                <span>{error}</span>
                            </div>
                        )}
                        <div className="grid gap-2">
                            <Label htmlFor="current">Current Password</Label>
                            <Input
                                id="current"
                                type="password"
                                value={currentPassword}
                                onChange={(e) => setCurrentPassword(e.target.value)}
                                required
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="new">New Password</Label>
                            <Input
                                id="new"
                                type="password"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                required
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="confirm">Confirm New Password</Label>
                            <Input
                                id="confirm"
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                required
                            />
                        </div>
                    </CardContent>
                    <CardFooter className="mt-6">
                        <Button type="submit" disabled={isLoading}>
                            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Update Password
                        </Button>
                    </CardFooter>
                </form>
            </Card>

            {/* Active Sessions Card */}
            <Card className="border-white/10 bg-black/20 backdrop-blur-sm">
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <Monitor className="w-5 h-5 text-green-400" />
                        <CardTitle>Active Sessions</CardTitle>
                    </div>
                    <CardDescription>
                        Manage devices where you're logged in.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                    {sessions.length === 0 ? (
                        <p className="text-sm text-muted-foreground">Loading sessions...</p>
                    ) : (
                        sessions.map((session) => (
                            <div
                                key={session.token || session.id}
                                className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/10"
                            >
                                <div className="flex items-center gap-3">
                                    {session.userAgent?.includes('Mobile') ? (
                                        <Smartphone className="w-5 h-5 text-zinc-400" />
                                    ) : (
                                        <Monitor className="w-5 h-5 text-zinc-400" />
                                    )}
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-medium">
                                                {session.userAgent?.split(' ')[0] || 'Unknown Browser'}
                                            </span>
                                            {session.isCurrent && (
                                                <Badge variant="secondary" className="text-[10px] bg-green-500/20 text-green-400 border-green-500/30">
                                                    Current Device
                                                </Badge>
                                            )}
                                        </div>
                                        <p className="text-xs text-muted-foreground">
                                            Last active: {session.updatedAt ? new Date(session.updatedAt).toLocaleDateString() : 'Recently'}
                                        </p>
                                    </div>
                                </div>
                                {!session.isCurrent && (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleRevokeSession(session.token)}
                                        className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                                    >
                                        <X className="w-4 h-4 mr-1" />
                                        Revoke
                                    </Button>
                                )}
                            </div>
                        ))
                    )}
                </CardContent>
            </Card>

            {/* Danger Zone */}
            <Card className="border-red-500/20 bg-red-500/5 backdrop-blur-sm">
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <Trash2 className="w-5 h-5 text-red-400" />
                        <CardTitle className="text-red-400">Danger Zone</CardTitle>
                    </div>
                    <CardDescription className="text-red-200/60">
                        Irreversible actions for your account.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-zinc-400 mb-4">
                        Deleting your account will remove all your curated collections, tags, and preferences.
                    </p>
                    <Button variant="destructive" onClick={handleDeleteAccount} className="bg-red-900/50 hover:bg-red-900 border border-red-500/30 text-red-200">
                        Delete Account
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
}
