'use client';

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { supabase, signOut } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { useRouter, usePathname } from "next/navigation";
import { User, Settings, Shield, LogOut, ChevronDown, Bookmark, Heart, Users, Database, Trophy } from "lucide-react";
import NotificationBell from "@/components/ui/NotificationBell";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Session } from "@supabase/supabase-js";

export function Navbar() {
    const [session, setSession] = useState<Session | null>(null);
    const [isPending, setIsPending] = useState(true);
    const [userRole, setUserRole] = useState<string | null>(null);
    const router = useRouter();
    const pathname = usePathname();
    const isSetupPage = pathname === '/setup';

    useEffect(() => {
        // Get initial session
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            setIsPending(false);

            // Fetch profile for role
            if (session?.user?.id) {
                supabase
                    .from('profiles')
                    .select('role')
                    .eq('id', session.user.id)
                    .single()
                    .then(({ data }) => {
                        setUserRole(data?.role || null);
                    });
            }
        });

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
            if (session?.user?.id) {
                supabase
                    .from('profiles')
                    .select('role')
                    .eq('id', session.user.id)
                    .single()
                    .then(({ data }) => {
                        setUserRole(data?.role || null);
                    });
            } else {
                setUserRole(null);
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    const userImage = session?.user?.user_metadata?.avatar_url as string | null | undefined;

    const handleSignOut = async () => {
        await signOut();
        router.push('/login');
    };

    return (
        <nav className="sticky top-0 z-50 border-b border-white/10 bg-black/60 backdrop-blur-[10px] supports-[backdrop-filter]:bg-black/60">
            <div className="container mx-auto flex h-16 items-center px-4 justify-between">

                {/* Left Side: Logo & Main Nav */}
                <div className="flex items-center">
                    <Link className="mr-6 flex items-center space-x-2" href="/">
                        <span className="hidden font-serif font-bold text-xl sm:inline-block">
                            Curator
                        </span>
                    </Link>

                    <nav className="flex items-center space-x-6 text-sm font-medium">
                        {!isSetupPage && (
                            <>
                                <Link className="transition-colors hover:text-foreground/80 text-foreground/60" href="/browse" data-tour="browse">Browse</Link>
                                <Link className="transition-colors hover:text-foreground/80 text-foreground/60 flex items-center gap-1.5" href="/leaderboards" data-tour="leaderboards">
                                    <Trophy className="h-3.5 w-3.5" />
                                    Leaderboards
                                </Link>
                            </>
                        )}
                    </nav>
                </div>

                {/* Right Side: User Menu */}
                <div className="flex items-center space-x-4">
                    {isPending ? (
                        <div className="text-sm text-foreground/40">Loading...</div>
                    ) : session ? (
                        <>
                            {/* Notification Bell for Admins */}
                            {(userRole === 'ADMIN' || userRole === 'admin') && (
                                <NotificationBell />
                            )}
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        className="flex items-center gap-2 px-2 hover:bg-white/10"
                                    >
                                        {userImage ? (
                                            <Image
                                                src={userImage}
                                                alt="Avatar"
                                                width={32}
                                                height={32}
                                                className="rounded-full border border-white/10 object-cover"
                                            />
                                        ) : (
                                            <div className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-zinc-800 text-zinc-400">
                                                <User size={16} />
                                            </div>
                                        )}
                                        <span className="text-sm text-muted-foreground hidden md:block max-w-[150px] truncate">
                                            {session.user?.email}
                                        </span>
                                        <ChevronDown size={14} className="text-muted-foreground" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent
                                    align="end"
                                    className="w-56 bg-zinc-900 border-zinc-800"
                                >
                                    <DropdownMenuLabel className="font-normal">
                                        <div className="flex flex-col space-y-1">
                                            <p className="text-xs text-muted-foreground">Signed in as</p>
                                            <p className="text-sm font-medium truncate">{session.user?.email}</p>
                                        </div>
                                    </DropdownMenuLabel>
                                    <DropdownMenuSeparator className="bg-zinc-800" />

                                    <DropdownMenuItem asChild>
                                        <Link href="/bookmarks" className="flex items-center cursor-pointer">
                                            <Bookmark className="mr-2 h-4 w-4" />
                                            <span>Bookmarks</span>
                                        </Link>
                                    </DropdownMenuItem>

                                    <DropdownMenuItem asChild>
                                        <Link href="/liked" className="flex items-center cursor-pointer">
                                            <Heart className="mr-2 h-4 w-4" />
                                            <span>Liked</span>
                                        </Link>
                                    </DropdownMenuItem>

                                    <DropdownMenuItem asChild>
                                        <Link href="/following" className="flex items-center cursor-pointer">
                                            <Users className="mr-2 h-4 w-4" />
                                            <span>Following</span>
                                        </Link>
                                    </DropdownMenuItem>

                                    <DropdownMenuItem asChild>
                                        <Link href="/settings" className="flex items-center cursor-pointer">
                                            <Settings className="mr-2 h-4 w-4" />
                                            <span>Settings</span>
                                        </Link>
                                    </DropdownMenuItem>

                                    {(userRole === 'ADMIN' || userRole === 'admin') && (
                                        <>
                                            <DropdownMenuSeparator className="bg-zinc-800" />
                                            <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
                                                Admin Tools
                                            </DropdownMenuLabel>
                                            <DropdownMenuItem asChild>
                                                <Link href="/admin" className="flex items-center cursor-pointer">
                                                    <Shield className="mr-2 h-4 w-4" />
                                                    <span>Admin Dashboard</span>
                                                </Link>
                                            </DropdownMenuItem>
                                            <DropdownMenuItem asChild>
                                                <Link href="/admin/data-browser" className="flex items-center cursor-pointer">
                                                    <Database className="mr-2 h-4 w-4" />
                                                    <span>Data Browser</span>
                                                </Link>
                                            </DropdownMenuItem>
                                        </>
                                    )}

                                    <DropdownMenuSeparator className="bg-zinc-800" />

                                    <DropdownMenuItem
                                        onClick={handleSignOut}
                                        className="text-red-400 focus:text-red-400 focus:bg-red-950/50 cursor-pointer"
                                    >
                                        <LogOut className="mr-2 h-4 w-4" />
                                        <span>Sign Out</span>
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </>
                    ) : (
                        !isSetupPage && (
                            <Link href="/login">
                                <Button size="sm" className="rounded-full px-6">
                                    Sign In
                                </Button>
                            </Link>
                        )
                    )}
                </div>
            </div>
        </nav>
    );
}
