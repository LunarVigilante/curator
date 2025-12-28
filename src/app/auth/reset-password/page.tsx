'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { authClient } from "@/lib/auth-client";
import { Loader2, Lock, ArrowLeft } from "lucide-react";
import Link from 'next/link';

export default function ResetPasswordPage() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const token = searchParams.get('token');

    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isPending, setIsPending] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!token) {
            setError('Invalid or expired reset token.');
        }
    }, [token]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (newPassword !== confirmPassword) {
            setError('Passwords do not match.');
            return;
        }
        if (newPassword.length < 8) {
            setError('Password must be at least 8 characters long.');
            return;
        }

        setIsPending(true);
        setError('');

        try {
            const { error } = await authClient.resetPassword({
                newPassword,
                token: token!,
            });

            if (error) {
                setError(error.message || "Failed to reset password");
            } else {
                setIsSuccess(true);
                setTimeout(() => {
                    router.push('/auth/login');
                }, 3000);
            }
        } catch (err) {
            setError("An unexpected error occurred");
        } finally {
            setIsPending(false);
        }
    };

    if (!token && !error) return null;

    return (
        <div className="flex min-h-screen items-center justify-center bg-gray-950 px-4">
            <div className="w-full max-w-md space-y-8 bg-gray-900 p-8 rounded-xl border border-gray-800">

                {/* Header */}
                <div className="text-center">
                    <h2 className="text-3xl font-bold text-white">New Password</h2>
                    <p className="mt-2 text-gray-400">
                        Set a new password for your account.
                    </p>
                </div>

                {isSuccess ? (
                    <div className="bg-green-900/20 border border-green-800 p-6 rounded-lg text-center">
                        <h3 className="text-lg font-medium text-green-400">Success!</h3>
                        <p className="mt-2 text-sm text-gray-400">
                            Your password has been reset. Redirecting to login...
                        </p>
                    </div>
                ) : (
                    <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
                        <div className="space-y-4">
                            <div>
                                <label className="text-sm font-medium text-gray-300">New Password</label>
                                <input
                                    type="password"
                                    required
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    className="mt-1 block w-full rounded-md border border-gray-700 bg-gray-950 px-3 py-3 text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 sm:text-sm"
                                    placeholder="********"
                                />
                            </div>
                            <div>
                                <label className="text-sm font-medium text-gray-300">Confirm Password</label>
                                <input
                                    type="password"
                                    required
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    className="mt-1 block w-full rounded-md border border-gray-700 bg-gray-950 px-3 py-3 text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 sm:text-sm"
                                    placeholder="********"
                                />
                            </div>
                        </div>

                        {error && (
                            <div className="text-red-400 text-sm text-center bg-red-950/30 p-2 rounded border border-red-900">
                                {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={isPending || !!error}
                            className="group relative flex w-full justify-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isPending ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                                "Reset Password"
                            )}
                        </button>
                    </form>
                )}

                <div className="text-center mt-4">
                    <Link href="/auth/login" className="flex items-center justify-center text-sm text-gray-400 hover:text-white transition">
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Back to Login
                    </Link>
                </div>
            </div>
        </div>
    );
}
