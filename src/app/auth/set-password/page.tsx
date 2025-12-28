'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { setPasswordAction } from "@/lib/actions/admin";
import { Loader2, Lock } from "lucide-react";
import { toast } from 'sonner';

export default function SetPasswordPage() {
    const router = useRouter();
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (password.length < 8) {
            toast.error("Password must be at least 8 characters");
            return;
        }

        if (password !== confirmPassword) {
            toast.error("Passwords do not match");
            return;
        }

        setIsLoading(true);

        try {
            const result = await setPasswordAction(password);

            if (!result.success) {
                toast.error(result.error || "Failed to set password");
            } else {
                toast.success("Password set successfully!");
                router.push('/');
            }
        } catch (err) {
            toast.error("Something went wrong");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex min-h-screen items-center justify-center bg-zinc-950 p-4">
            <div className="w-full max-w-md bg-zinc-900 border border-white/10 rounded-xl p-8 space-y-6">
                <div className="text-center space-y-2">
                    <div className="mx-auto w-12 h-12 bg-blue-500/10 rounded-full flex items-center justify-center mb-4">
                        <Lock className="w-6 h-6 text-blue-500" />
                    </div>
                    <h1 className="text-2xl font-bold text-white">Set Your Password</h1>
                    <p className="text-zinc-400">Please choose a secure password for your account.</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-zinc-300">New Password</label>
                        <input
                            type="password"
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full bg-zinc-950 border border-white/10 rounded-md px-3 py-2 text-white focus:ring-2 focus:ring-blue-500/50 outline-none"
                            placeholder="Min. 8 characters"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-zinc-300">Confirm Password</label>
                        <input
                            type="password"
                            required
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            className="w-full bg-zinc-950 border border-white/10 rounded-md px-3 py-2 text-white focus:ring-2 focus:ring-blue-500/50 outline-none"
                            placeholder="Re-enter password"
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium py-2.5 rounded-md transition-colors disabled:opacity-50 flex items-center justify-center"
                    >
                        {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Set Password"}
                    </button>
                </form>
            </div>
        </div>
    );
}
