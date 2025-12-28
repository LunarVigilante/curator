# Supabase Auth Migration Guide

## Overview
This guide explains how to replace your custom NextAuth.js setup with Supabase Native Auth.

---

## 1. Install Supabase Client

```bash
npm install @supabase/supabase-js @supabase/ssr
```

---

## 2. Create Supabase Client

### `src/lib/supabase/client.ts` (Browser)
```typescript
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

### `src/lib/supabase/server.ts` (Server Components / Actions)
```typescript
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Ignore in Server Components
          }
        },
      },
    }
  )
}
```

---

## 3. Replace `useSession()` Calls

### Old (NextAuth)
```typescript
import { useSession } from 'next-auth/react'

function Component() {
  const { data: session, status } = useSession()
  const userId = session?.user?.id
}
```

### New (Supabase)
```typescript
'use client'
import { createClient } from '@/lib/supabase/client'
import { useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'

function Component() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    // Get initial session
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user)
      setLoading(false)
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setUser(session?.user ?? null)
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  const userId = user?.id
}
```

---

## 4. Custom Hook (Recommended)

### `src/hooks/useUser.ts`
```typescript
'use client'
import { createClient } from '@/lib/supabase/client'
import { useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'

interface Profile {
  id: string
  name: string | null
  displayName: string | null
  image: string | null
  role: 'USER' | 'ADMIN' | 'MODERATOR'
  isPublic: boolean
}

export function useUser() {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    async function loadUser() {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)

      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single()
        setProfile(profile)
      }

      setLoading(false)
    }

    loadUser()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setUser(session?.user ?? null)
        if (!session?.user) {
          setProfile(null)
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  return { user, profile, loading, isAuthenticated: !!user }
}
```

### Usage
```typescript
function MyComponent() {
  const { user, profile, loading, isAuthenticated } = useUser()

  if (loading) return <Spinner />
  if (!isAuthenticated) return <LoginButton />

  return <div>Hello, {profile?.name || user?.email}</div>
}
```

---

## 5. Server-Side Auth (Actions & API Routes)

### In Server Actions
```typescript
'use server'
import { createClient } from '@/lib/supabase/server'

export async function getMyItems() {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { data } = await supabase
    .from('items')
    .select('*')
    .eq('user_id', user.id)

  return data
}
```

### Getting User ID in Prisma
```typescript
'use server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'

export async function getMyCategories() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) throw new Error('Unauthorized')

  // Use Prisma with the Supabase user ID
  return prisma.category.findMany({
    where: { userId: user.id }
  })
}
```

---

## 6. Auth Actions (Login, Signup, Logout)

### `src/lib/actions/auth.ts`
```typescript
'use server'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function signIn(formData: FormData) {
  const supabase = await createClient()

  const { error } = await supabase.auth.signInWithPassword({
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  })

  if (error) {
    return { error: error.message }
  }

  redirect('/dashboard')
}

export async function signUp(formData: FormData) {
  const supabase = await createClient()

  const { error } = await supabase.auth.signUp({
    email: formData.get('email') as string,
    password: formData.get('password') as string,
    options: {
      data: {
        name: formData.get('name') as string,
      }
    }
  })

  if (error) {
    return { error: error.message }
  }

  redirect('/verify-email')
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}
```

---

## 7. Environment Variables

Add to `.env`:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbG...your-anon-key
```

---

## 8. Middleware (Protect Routes)

### `src/middleware.ts`
```typescript
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
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

  const { data: { user } } = await supabase.auth.getUser()

  // Protected routes
  const protectedPaths = ['/dashboard', '/settings', '/admin']
  const isProtected = protectedPaths.some(path => 
    request.nextUrl.pathname.startsWith(path)
  )

  if (isProtected && !user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
```

---

## Summary: Key Replacements

| Old (NextAuth) | New (Supabase) |
|----------------|----------------|
| `useSession()` | `supabase.auth.getUser()` |
| `session?.user?.id` | `user?.id` |
| `signIn()` | `supabase.auth.signInWithPassword()` |
| `signOut()` | `supabase.auth.signOut()` |
| `getServerSession()` | `createClient()` → `auth.getUser()` |
