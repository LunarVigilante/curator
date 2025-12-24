'use client';

import { authClient } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";

export function AdminGuard({ children }: { children: React.ReactNode }) {
    const { data: session, isPending, error } = authClient.useSession();
    const router = useRouter();

    useEffect(() => {
        if (!isPending) {
            if (!session) {
                router.replace('/login'); // Redirect to login if not authenticated
            } else if ((session.user as any).role !== 'ADMIN') {
                router.replace('/'); // Redirect to home if not admin
            }
        }
    }, [session, isPending, router]);

    if (isPending) {
        return (
            <div className="flex h-screen w-full items-center justify-center bg-black text-white">
                <Loader2 className="animate-spin text-blue-500" size={48} />
            </div>
        );
    }

    if (!session || (session.user as any).role !== 'ADMIN') {
        // Return null while redirecting to avoid flash of content (or unauthorized content)
        return null;
    }

    return <>{children}</>;
}
