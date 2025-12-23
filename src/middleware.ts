import NextAuth from "next-auth"
import { authConfig } from "./auth.config"
import { NextResponse } from "next/server"

const { auth } = NextAuth(authConfig)

export default auth((req) => {
    const isLoggedIn = !!req.auth
    const isOnDashboard = req.nextUrl.pathname.startsWith('/admin')
    const isOnLogin = req.nextUrl.pathname.startsWith('/login')
    const isOnRegister = req.nextUrl.pathname.startsWith('/register')

    if (isOnDashboard) {
        if (isLoggedIn) return NextResponse.next()
        return NextResponse.redirect(new URL('/login', req.nextUrl))
    }

    if (isLoggedIn && (isOnLogin || isOnRegister)) {
        return NextResponse.redirect(new URL('/', req.nextUrl))
    }

    return NextResponse.next()
})

export const config = {
    matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}
