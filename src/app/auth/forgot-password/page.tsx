'use client';

import { useState } from 'react';
import { authClient } from "@/lib/auth-client"; // Your BetterAuth client
import { Loader2, ArrowLeft, Mail } from "lucide-react";
import Link from 'next/link';

export default function ForgotPasswordPage() {
    const [email, setEmail] = useState('');
    const [isPending, setIsPending] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsPending(true);
        setError('');

        try {
            const { error } = await authClient.requestPasswordReset({
                email,
                redirectTo: "/auth/reset-password",
            });

            if (error) {
                setError(error.message || "Failed to send reset email");
            } else {
                setIsSuccess(true);
            }
        } catch (err) {
            setError("An unexpected error occurred");
        } finally {
            setIsPending(false);
        }
    };

    return (
        <div className="flex min-h-screen items-center justify-center bg-gray-950 px-4">
            <div className="w-full max-w-md space-y-8 bg-gray-900 p-8 rounded-xl border border-gray-800">

                {/* Header */}
                <div className="text-center">
                    <h2 className="text-3xl font-bold text-white">Reset Password</h2>
                    <p className="mt-2 text-gray-400">
                        Enter your email to receive a reset link.
                    </p>
                </div>

                {/* Success State */}
                {isSuccess ? (
                    <div className="bg-green-900/20 border border-green-800 p-6 rounded-lg text-center">
                        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-900/50 mb-4">
                            <Mail className="h-6 w-6 text-green-400" />
                        </div>
                        <h3 className="text-lg font-medium text-green-400">Check your email</h3>
                        <p className="mt-2 text-sm text-gray-400">
                            We have sent a password reset link to <strong>{email}</strong>.
                        </p>
                        <button
                            onClick={() => setIsSuccess(false)}
                            className="mt-6 text-sm text-blue-400 hover:text-blue-300"
                        >
                            Try a different email
                        </button>
                    </div>
                ) : (
                    /* Form State */
                    <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
                        <div>
                            <label htmlFor="email" className="sr-only">Email address</label>
                            <input
                                id="email"
                                name="email"
                                type="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="relative block w-full rounded-md border border-gray-700 bg-gray-950 px-3 py-3 text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 sm:text-sm"
                                placeholder="Email address"
                            />
                        </div>

                        {error && (
                            <div className="text-red-400 text-sm text-center bg-red-950/30 p-2 rounded border border-red-900">
                                {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={isPending}
                            className="group relative flex w-full justify-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isPending ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                                "Send Reset Link"
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
