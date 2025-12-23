import type { NextAuthConfig } from "next-auth"

export const authConfig = {
    pages: {
        signIn: '/login',
    },
    callbacks: {
        async session({ session, token }) {
            console.log('AUTH_DEBUG: Session Callback', { tokenSub: token?.sub, sessionUser: !!session?.user })
            if (token.sub && session.user) {
                session.user.id = token.sub
            }
            if (token.role && session.user) {
                session.user.role = token.role as string
            }
            return session
        },
        async jwt({ token, user }) {
            console.log('AUTH_DEBUG: JWT Callback', { hasUser: !!user })
            if (user) {
                token.role = (user as any).role
            }
            return token
        }
    },
    session: {
        strategy: "jwt",
    },
    providers: [], // Configured in auth.ts
} satisfies NextAuthConfig
