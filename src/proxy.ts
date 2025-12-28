import { auth } from "@/lib/auth";
import { fromNodeHeaders } from "better-auth/node";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Simple cache to avoid DB check on every request
let setupCheckCache: { isRequired: boolean | null; checkedAt: number } = {
    isRequired: null,
    checkedAt: 0,
};
const CACHE_TTL = 60000; // 1 minute

export default async function middleware(request: NextRequest) {
    const pathname = request.nextUrl.pathname;

    // 0. Setup Check - Redirect to setup if no users exist
    const isSetupRoute = pathname.startsWith('/setup') || pathname.startsWith('/api/setup');
    const isStaticAsset = pathname.startsWith('/_next') || pathname.startsWith('/images') || pathname.includes('.');

    if (!isSetupRoute && !isStaticAsset) {
        const now = Date.now();
        if (setupCheckCache.isRequired === null || now - setupCheckCache.checkedAt > CACHE_TTL) {
            try {
                const checkUrl = new URL('/api/setup/check', request.url);
                const response = await fetch(checkUrl, {
                    headers: { 'x-middleware-check': 'true' },
                });
                const data = await response.json();
                setupCheckCache = { isRequired: data.setupRequired, checkedAt: now };
            } catch (error) {
                // If check fails, assume setup not required
                console.error('Setup check failed:', error);
            }
        }

        if (setupCheckCache.isRequired) {
            return NextResponse.redirect(new URL('/setup', request.url));
        }
    }

    // 1. Check for Login/Register routes -> Redirect to home if logged in
    const isAuthRoute = pathname.startsWith('/login') || pathname.startsWith('/register');
    const isChangePassword = pathname.startsWith('/change-password');
    const isSignOut = pathname.startsWith('/api/auth/sign-out'); // Allow signout

    // 2. Fetch Session
    // BetterAuth middleware helper is available but manual fetch gives us custom fields like 'requiredPasswordChange'
    const session = await auth.api.getSession({
        headers: request.headers
    });

    if (session) {
        // User is logged in
        if (isAuthRoute) {
            return NextResponse.redirect(new URL('/', request.url));
        }

        // 3. Force Password Change
        // Check custom user field
        if (session.user.requiredPasswordChange && !isChangePassword && !isSignOut) {
            return NextResponse.redirect(new URL('/change-password', request.url));
        }

        // 4. Admin-Only Routes Protection
        const adminOnlyRoutes = ['/items', '/tags', '/admin'];
        const isAdminRoute = adminOnlyRoutes.some(route => pathname.startsWith(route));

        if (isAdminRoute) {
            const userRole = (session.user as any).role;
            if (userRole !== 'ADMIN' && userRole !== 'admin') {
                // Non-admin trying to access admin routes - redirect to home
                return NextResponse.redirect(new URL('/', request.url));
            }
        }
    } else {
        // User is NOT logged in
        // Protect Dashboard or other private routes
        // For 'Invite Only', maybe protect everything except Login?
        // DISABLED FOR DEBUG: Admin protection
        // if (pathname.startsWith('/admin')) {
        //     return NextResponse.redirect(new URL('/login', request.url));
        // }

        // Also block /register public route explicitly 
        if (pathname.startsWith('/register')) {
            return NextResponse.redirect(new URL('/login', request.url));
        }

        if (pathname.startsWith('/api/auth/sign-up')) {
            return new NextResponse("Public registration is disabled.", { status: 403 });
        }
    }

    return NextResponse.next();
}

export const config = {
    // Run on everything except statics, but ALLOW api so we can block sign-up
    matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};

