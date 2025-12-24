'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { authClient } from '@/lib/auth-client';
import { completeForcePasswordChange } from '@/lib/actions/auth';
import { Loader2, ShieldCheck } from 'lucide-react';

export default function ChangePasswordPage() {
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const router = useRouter();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (newPassword !== confirmPassword) {
            toast.error("New passwords do not match.");
            return;
        }

        setIsLoading(true);

        try {
            // 1. Change password via Client API (handles hashing and verification)
            await authClient.changePassword({
                currentPassword,
                newPassword,
                revokeOtherSessions: true
            }, {
                onSuccess: async () => {
                    // 2. Server Action to clear the 'requiredPasswordChange' flag
                    await completeForcePasswordChange();

                    toast.success("Password updated securely.");
                    // 3. Redirect back to Home
                    router.push('/');
                    // Force refresh to update session context in Guard
                    router.refresh();
                },
                onError: (ctx) => {
                    toast.error(ctx.error.message || "Failed to update password.");
                    setIsLoading(false);
                }
            });

        } catch (err) {
            toast.error("An unexpected error occurred.");
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-zinc-950 px-4">
            <div className="w-full max-w-md space-y-8 bg-zinc-900/50 p-8 rounded-xl border border-white/10 backdrop-blur-md">
                <div className="text-center">
                    <div className="mx-auto h-12 w-12 flex items-center justify-center rounded-full bg-blue-500/10 mb-4">
                        <ShieldCheck className="h-6 w-6 text-blue-400" />
                    </div>
                    <h2 className="text-3xl font-bold tracking-tight text-white">Security Update</h2>
                    <p className="mt-2 text-sm text-zinc-400">
                        Your account requires a password change to continue.
                    </p>
                </div>

                <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-zinc-300">
                                Current Password
                            </label>
                            <input
                                type="password"
                                required
                                value={currentPassword}
                                onChange={(e) => setCurrentPassword(e.target.value)}
                                className="mt-1 block w-full rounded-md bg-black/50 border border-white/10 px-3 py-2 text-white outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="Enter current password"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-zinc-300">
                                New Password
                            </label>
                            <input
                                type="password"
                                required
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                className="mt-1 block w-full rounded-md bg-black/50 border border-white/10 px-3 py-2 text-white outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="Enter new strong password"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-zinc-300">
                                Confirm New Password
                            </label>
                            <input
                                type="password"
                                required
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                className="mt-1 block w-full rounded-md bg-black/50 border border-white/10 px-3 py-2 text-white outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="Confirm new password"
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={isLoading}
                        className="group relative flex w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-black hover:bg-zinc-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:opacity-70 transition-all"
                    >
                        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin text-zinc-600" />}
                        Update Password & Continue
                    </button>
                </form>
            </div>
        </div>
    );
}
