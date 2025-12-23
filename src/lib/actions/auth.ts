'use server'

import { signIn } from '@/auth'
import { AuthError } from 'next-auth'
import { db } from '@/lib/db'
import { users } from '@/db/schema'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { eq } from 'drizzle-orm'

export async function authenticate(
    prevState: string | undefined,
    formData: FormData,
) {
    try {
        await signIn('credentials', formData)
    } catch (error) {
        if (error instanceof AuthError) {
            switch (error.type) {
                case 'CredentialsSignin':
                    return 'Invalid credentials.'
                default:
                    return 'Something went wrong.'
            }
        }
        throw error
    }
}

const RegisterSchema = z.object({
    username: z.string().min(3, { message: 'Username must be at least 3 characters long.' }),
    password: z.string().min(6, { message: 'Password must be at least 6 characters long.' }),
})

export type RegisterState = {
    errors?: {
        username?: string[]
        password?: string[]
    }
    message?: string
} | undefined

export async function register(prevState: RegisterState, formData: FormData) {
    const validatedFields = RegisterSchema.safeParse({
        username: formData.get('username'),
        password: formData.get('password'),
    })

    if (!validatedFields.success) {
        return {
            errors: validatedFields.error.flatten().fieldErrors,
            message: 'Missing Fields. Failed to Register.',
        }
    }

    const { username, password } = validatedFields.data

    try {
        // Check if user exists
        const existingUser = await db.query.users.findFirst({
            where: eq(users.username, username)
        })

        if (existingUser) {
            return {
                message: 'Username already taken.',
            }
        }

        // Check if this is the first user (to make admin)
        const allUsers = await db.query.users.findMany({ limit: 1 })
        const role = allUsers.length === 0 ? 'ADMIN' : 'USER'

        const hashedPassword = await bcrypt.hash(password, 10)

        await db.insert(users).values({
            username,
            password: hashedPassword,
            role,
        })

    } catch (error) {
        return {
            message: 'Database Error: Failed to Create User.',
        }
    }

    // Redirect to login (or auto-login)
    // For now, let's just return success or redirect manually in UI?
    // Actually, we can just call signIn here? No, better to let user login.
    // But we need to redirect.
    try {
        await signIn('credentials', formData)
    } catch (error) {
        if (error instanceof AuthError) {
            switch (error.type) {
                case 'CredentialsSignin':
                    return { message: 'Registration successful but login failed.' }
                default:
                    return { message: 'Something went wrong.' }
            }
        }
        throw error
    }
}

export async function getGuestUserId() {
    // Try to find existing guest user
    const guest = await db.query.users.findFirst({
        where: eq(users.username, 'guest')
    })

    if (guest) {
        return guest.id
    }

    // Create guest user if not exists
    const hashedPassword = await bcrypt.hash('guestDefaultPassword123!', 10)
    const [newGuest] = await db.insert(users).values({
        username: 'guest',
        password: hashedPassword,
        role: 'USER'
    }).returning()

    return newGuest.id
}
