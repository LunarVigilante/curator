'use client';

import Link from "next/link";
import { authClient } from "@/lib/auth-client"; // Client-side auth
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { User } from "lucide-react";

export function Navbar() {
    // Hooks
    const { data: session, isPending } = authClient.useSession();
    const router = useRouter();
    // Use type assertion for image as it might be missing from the default session type definition but present in runtime
    const userImage = session?.user?.image as string | null | undefined;

    const handleSignOut = async () => {
        await authClient.signOut({
            fetchOptions: {
                onSuccess: () => {
                    router.push('/login'); // Redirect to login after sign out
                }
            }
        });
    };

    return (
        <nav className="sticky top-0 z-50 border-b border-white/10 bg-black/60 backdrop-blur-[10px] supports-[backdrop-filter]:bg-black/60">
            <div className="container mx-auto flex h-16 items-center px-4 justify-between">

                {/* Left Side: Logo & Main Nav (Protected) */}
                <div className="flex items-center">
                    <Link className="mr-6 flex items-center space-x-2" href="/">
                        <span className="hidden font-serif font-bold text-xl sm:inline-block">
                            Curator
                        </span>
                    </Link>

                    <nav className="flex items-center space-x-6 text-sm font-medium">
                        <Link className="transition-colors hover:text-foreground/80 text-foreground/60" href="/browse">Browse</Link>

                        {/* Render Links ONLY if Logged In */}
                        {session && !isPending && (
                            <>
                                <Link className="transition-colors hover:text-foreground/80 text-foreground/60" href="/items">Items</Link>
                                <Link className="transition-colors hover:text-foreground/80 text-foreground/60" href="/tags">Tags</Link>
                                <Link className="transition-colors hover:text-foreground/80 text-foreground/60" href="/settings">Settings</Link>

                                {/* Admin Link Guard */}
                                {(session.user as any).role === 'ADMIN' && (
                                    <Link className="transition-colors hover:text-red-400 text-foreground/60" href="/admin">
                                        Admin
                                    </Link>
                                )}
                            </>
                        )}
                    </nav>
                </div>

                {/* Right Side: Auth Buttons */}
                <div className="flex items-center space-x-4">
                    {isPending ? (
                        // Loading State (optional spinner)
                        <div className="text-sm text-foreground/40">Loading...</div>
                    ) : session ? (
                        // User Profile / Sign Out
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-3">
                                {userImage ? (
                                    <img
                                        src={userImage}
                                        alt="Avatar"
                                        className="h-8 w-8 rounded-full border border-white/10 object-cover"
                                    />
                                ) : (
                                    <div className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-zinc-800 text-zinc-400">
                                        <User size={16} />
                                    </div>
                                )}
                                <span className="text-sm text-muted-foreground hidden md:block">
                                    {session.user.email}
                                </span>
                            </div>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleSignOut}
                            >
                                Sign Out
                            </Button>
                        </div>
                    ) : (
                        // Not Logged In
                        <Link href="/login">
                            <Button size="sm" className="rounded-full px-6">
                                Sign In
                            </Button>
                        </Link>
                    )}
                </div>
            </div>
        </nav>
    );
}
