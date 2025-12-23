import { auth } from "@/lib/auth";
import { fromNodeHeaders } from "better-auth/node";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export default async function middleware(request: NextRequest) {
    // 1. Check for Login/Register routes -> Redirect to home if logged in
    const isAuthRoute = request.nextUrl.pathname.startsWith('/login') || request.nextUrl.pathname.startsWith('/register');
    const isChangePassword = request.nextUrl.pathname.startsWith('/change-password');
    const isSignOut = request.nextUrl.pathname.startsWith('/api/auth/sign-out'); // Allow signout

    // 2. Fetch Session
    // BetterAuth middleware helper is available but manual fetch gives us custom fields like 'requiredPasswordChange'
    const session = await auth.api.getSession({
        headers: fromNodeHeaders(request.headers)
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
    } else {
        // User is NOT logged in
        // Protect Dashboard or other private routes
        // For 'Invite Only', maybe protect everything except Login?
        // Let's protect /admin
        if (request.nextUrl.pathname.startsWith('/admin')) {
            return NextResponse.redirect(new URL('/login', request.url));
        }

        // Also block /register public route explicitly 
        if (request.nextUrl.pathname.startsWith('/register')) {
            return NextResponse.redirect(new URL('/login', request.url));
        }

        if (request.nextUrl.pathname.startsWith('/api/auth/sign-up')) {
            return new NextResponse("Public registration is disabled.", { status: 403 });
        }
    }

    return NextResponse.next();
}

export const config = {
    // Run on everything except statics, but ALLOW api so we can block sign-up
    matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
