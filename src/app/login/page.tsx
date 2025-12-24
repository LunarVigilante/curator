'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { authClient } from '@/lib/auth-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Eye, EyeOff, Lock, Loader2 } from 'lucide-react';

export default function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const router = useRouter();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        await authClient.signIn.email({
            email,
            password,
        }, {
            onSuccess: (ctx) => {
                if (typeof window !== 'undefined' && (window as any).posthog) {
                    if (ctx.data?.user) {
                        (window as any).posthog.identify(ctx.data.user.id, { email: ctx.data.user.email });
                    }
                }
                router.push('/');
                router.refresh();
            },
            onError: (ctx) => {
                setError(ctx.error.message);
                setLoading(false);
            }
        });
    };

    return (
        <div className="flex items-center justify-center min-h-screen w-full p-4 relative z-10">
            <Card className="w-full max-w-md bg-black/40 backdrop-blur-xl border-white/10 shadow-2xl relative z-20">
                <CardHeader className="text-center space-y-2 pb-8 pt-10">
                    <div className="flex justify-center mb-2">
                        <h1 className="font-serif font-bold text-4xl tracking-tight text-white">
                            Curator
                        </h1>
                    </div>
                    <p className="text-sm text-zinc-400 font-medium tracking-wide">
                        Enter the vault.
                    </p>
                </CardHeader>
                <form onSubmit={handleLogin}>
                    <CardContent className="space-y-6 px-8">
                        <div className="space-y-2">
                            <Label htmlFor="email" className="text-zinc-300">Email</Label>
                            <Input
                                id="email"
                                type="email"
                                placeholder="me@example.com"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="bg-zinc-900/50 border-white/10 text-white placeholder:text-zinc-500 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="password" className="text-zinc-300">Password</Label>
                            <div className="relative">
                                <Input
                                    id="password"
                                    type={showPassword ? "text" : "password"}
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="bg-zinc-900/50 border-white/10 text-white pr-10 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white transition-colors"
                                    tabIndex={-1}
                                >
                                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                        </div>

                        {error && (
                            <div className="p-3 rounded-md bg-red-500/10 border border-red-500/20 text-red-400 text-sm text-center">
                                {error}
                            </div>
                        )}
                    </CardContent>

                    <CardFooter className="flex flex-col gap-6 px-8 pb-10 pt-2">
                        <Button
                            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium py-6 transition-all shadow-lg hover:shadow-blue-500/20 mt-2"
                            disabled={loading}
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Accessing...
                                </>
                            ) : 'Sign In'}
                        </Button>

                        <div className="flex items-center justify-center gap-2 text-zinc-500">
                            <Lock size={12} />
                            <span className="text-xs font-medium uppercase tracking-wider">Registration is Invite Only</span>
                        </div>
                    </CardFooter>
                </form>
            </Card>
        </div>
    );
}
