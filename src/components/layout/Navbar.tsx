'use client';

import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { User, Settings, Shield, LogOut, ChevronDown, List, Tag, Bookmark, Heart, Users } from "lucide-react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function Navbar() {
    const { data: session, isPending } = authClient.useSession();
    const router = useRouter();
    const userImage = session?.user?.image as string | null | undefined;
    const userRole = (session?.user as any)?.role;

    const handleSignOut = async () => {
        await authClient.signOut({
            fetchOptions: {
                onSuccess: () => {
                    router.push('/login');
                }
            }
        });
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
                        <Link className="transition-colors hover:text-foreground/80 text-foreground/60" href="/browse">Browse</Link>
                    </nav>
                </div>

                {/* Right Side: User Menu */}
                <div className="flex items-center space-x-4">
                    {isPending ? (
                        <div className="text-sm text-foreground/40">Loading...</div>
                    ) : session ? (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    variant="ghost"
                                    className="flex items-center gap-2 px-2 hover:bg-white/10"
                                >
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
                    ) : (
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
