'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { authClient } from '@/lib/auth-client';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Loader2, Trash2, KeyRound, AlertCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function ProfileSettings() {
    const [isLoading, setIsLoading] = useState(false);
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const router = useRouter();

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
                    <CardFooter>
                        <Button type="submit" disabled={isLoading}>
                            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Update Password
                        </Button>
                    </CardFooter>
                </form>
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
