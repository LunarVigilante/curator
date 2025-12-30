import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import type { Database } from '@/lib/types/database'

// Simple cache to avoid DB check on every request
let setupCheckCache: { isRequired: boolean | null; checkedAt: number } = {
    isRequired: null,
    checkedAt: 0,
}
const CACHE_TTL = 60000 // 1 minute

export default async function middleware(request: NextRequest) {
    let response = NextResponse.next({ request })
    const pathname = request.nextUrl.pathname

    // Create Supabase client for middleware
    const supabase = createServerClient<Database>(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll()
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value }) =>
                        request.cookies.set(name, value)
                    )
                    response = NextResponse.next({ request })
                    cookiesToSet.forEach(({ name, value, options }) =>
                        response.cookies.set(name, value, options)
                    )
                },
            },
        }
    )

    // 0. Setup Check - Redirect to setup if no users exist
    const isSetupRoute = pathname.startsWith('/setup') || pathname.startsWith('/api/setup')
    const isStaticAsset = pathname.startsWith('/_next') || pathname.startsWith('/images') || pathname.includes('.')

    if (!isSetupRoute && !isStaticAsset) {
        const now = Date.now()
        if (setupCheckCache.isRequired === null || now - setupCheckCache.checkedAt > CACHE_TTL) {
            try {
                const checkUrl = new URL('/api/setup/check', request.url)
                const checkResponse = await fetch(checkUrl, {
                    headers: { 'x-middleware-check': 'true' },
                })
                const data = await checkResponse.json()
                setupCheckCache = { isRequired: data.setupRequired, checkedAt: now }
            } catch (error) {
                // If check fails, assume setup not required
                console.error('Setup check failed:', error)
            }
        }

        if (setupCheckCache.isRequired) {
            return NextResponse.redirect(new URL('/setup', request.url))
        }
    }

    // 1. Check for Login/Register routes -> Redirect to home if logged in
    const isAuthRoute = pathname.startsWith('/login') || pathname.startsWith('/register')

    const isSignOut = pathname.startsWith('/auth/signout')

    // 2. Fetch Session from Supabase
    const { data: { user } } = await supabase.auth.getUser()

    if (user) {
        // User is logged in
        if (isAuthRoute) {
            return NextResponse.redirect(new URL('/', request.url))
        }

        // Fetch user profile for role and lockout checks
        const { data: profile } = await (supabase.from('profiles') as any)
            .select('role, is_locked_out')
            .eq('id', user.id)
            .single()

        // 3. Check if user is locked out
        if (profile?.is_locked_out && !isSignOut) {
            // Sign out the locked user
            await supabase.auth.signOut()
            return NextResponse.redirect(new URL('/login?error=locked', request.url))
        }

        // 4. Admin-Only Routes Protection
        const adminOnlyRoutes = ['/items', '/tags', '/admin']
        const isAdminRoute = adminOnlyRoutes.some(route => pathname.startsWith(route))

        if (isAdminRoute) {
            const userRole = profile?.role
            if (userRole !== 'ADMIN') {
                // Non-admin trying to access admin routes - redirect to home
                return NextResponse.redirect(new URL('/', request.url))
            }
        }
    } else {
        // User is NOT logged in
        // Block /register for invite-only system
        if (pathname.startsWith('/register')) {
            return NextResponse.redirect(new URL('/login', request.url))
        }

        // Block sign-up API
        if (pathname.startsWith('/auth/signup')) {
            return new NextResponse("Public registration is disabled.", { status: 403 })
        }
    }

    return response
}

export const config = {
    // Run on everything except statics, but ALLOW api so we can block sign-up
    matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
