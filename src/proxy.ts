import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import type { Database } from '@/lib/types/database'

// Cookie name for setup check cache (persists across hot-reloads)
const SETUP_VERIFIED_COOKIE = 'curator_setup_verified'
const SETUP_COOKIE_MAX_AGE = 86400 // 24 hours in seconds

export default async function middleware(request: NextRequest) {
    let response = NextResponse.next({ request })
    const pathname = request.nextUrl.pathname

    // Check for required environment variables
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

    if (!supabaseUrl || !supabaseAnonKey) {
        // Skip middleware if Supabase is not configured
        console.warn('Supabase environment variables not configured. Skipping middleware.')
        return response
    }

    // Create Supabase client for middleware
    const supabase = createServerClient<Database>(
        supabaseUrl,
        supabaseAnonKey,
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
        // Check cookie first - if verified, skip the API call entirely
        const setupVerifiedCookie = request.cookies.get(SETUP_VERIFIED_COOKIE)

        if (!setupVerifiedCookie) {
            // No cookie - need to check if setup is required
            try {
                const checkUrl = new URL('/api/setup/check', request.url)
                const checkResponse = await fetch(checkUrl, {
                    headers: { 'x-middleware-check': 'true' },
                })
                const data = await checkResponse.json()

                if (data.setupRequired) {
                    return NextResponse.redirect(new URL('/setup', request.url))
                }

                // Setup not required - set cookie to skip future checks
                response.cookies.set(SETUP_VERIFIED_COOKIE, 'true', {
                    httpOnly: true,
                    secure: process.env.NODE_ENV === 'production',
                    sameSite: 'lax',
                    maxAge: SETUP_COOKIE_MAX_AGE,
                    path: '/'
                })
            } catch (error) {
                // If check fails, assume setup not required
                console.error('Setup check failed:', error)
            }
        }
        // If cookie exists, skip the check entirely - setup was already verified
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
        // Note: /register is allowed - invite code validation happens at form submission

        // Block sign-up API for non-invite flows
        if (pathname.startsWith('/auth/signup')) {
            return new NextResponse("Public registration is disabled. Use an invite code.", { status: 403 })
        }
    }

    return response
}

export const config = {
    // Run on everything except statics, but ALLOW api so we can block sign-up
    matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
