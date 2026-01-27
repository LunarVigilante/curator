/**
 * Authentication Validation Schemas
 * 
 * Zod schemas for all authentication-related actions.
 * These ensure consistent validation across sign-in, sign-up, and password operations.
 */

import { z } from 'zod'
import { zfd } from 'zod-form-data'
import {
    INPUT_LIMITS,
    zodEmail,
    zodPassword,
    zodUsername
} from '@/lib/utils/input-sanitization'

// =============================================================================
// SIGN IN
// =============================================================================

export const signInSchema = z.object({
    email: zodEmail,
    password: z.string().min(1, 'Password is required').max(INPUT_LIMITS.PASSWORD_MAX),
})

export const signInFormSchema = zfd.formData({
    email: zfd.text(zodEmail),
    password: zfd.text(z.string().min(1, 'Password is required').max(INPUT_LIMITS.PASSWORD_MAX)),
})

export type SignInInput = z.infer<typeof signInSchema>

// =============================================================================
// REGISTRATION
// =============================================================================

export const registerSchema = z.object({
    username: zodUsername,
    email: zodEmail,
    password: zodPassword,
    inviteCode: z.string().length(INPUT_LIMITS.INVITE_CODE, 'Invalid invite code'),
})

export const registerFormSchema = zfd.formData({
    username: zfd.text(zodUsername),
    email: zfd.text(zodEmail),
    password: zfd.text(zodPassword),
    inviteCode: zfd.text(z.string().length(INPUT_LIMITS.INVITE_CODE, 'Invalid invite code')),
})

export type RegisterInput = z.infer<typeof registerSchema>

// =============================================================================
// PASSWORD OPERATIONS
// =============================================================================

export const updatePasswordSchema = z.object({
    password: zodPassword,
})

export const updatePasswordFormSchema = zfd.formData({
    password: zfd.text(zodPassword),
})

export const changePasswordSchema = z.object({
    currentPassword: z.string().min(1, 'Current password is required').max(INPUT_LIMITS.PASSWORD_MAX),
    newPassword: zodPassword,
})

export const resetPasswordSchema = z.object({
    email: zodEmail,
})

export const resetPasswordFormSchema = zfd.formData({
    email: zfd.text(zodEmail),
})

// =============================================================================
// PROFILE OPERATIONS
// =============================================================================

export const updateProfileSchema = z.object({
    name: z.string().min(1).max(INPUT_LIMITS.USERNAME).optional(),
    displayName: z.string().max(INPUT_LIMITS.DISPLAY_NAME).optional(),
    bio: z.string().max(INPUT_LIMITS.BIO).optional(),
})

export const updateProfileFormSchema = zfd.formData({
    name: zfd.text(z.string().min(1).max(INPUT_LIMITS.USERNAME).optional()),
    displayName: zfd.text(z.string().max(INPUT_LIMITS.DISPLAY_NAME).optional()),
    bio: zfd.text(z.string().max(INPUT_LIMITS.BIO).optional()),
})

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>

// =============================================================================
// SETUP (First Admin)
// =============================================================================

export const setupSchema = z.object({
    email: zodEmail,
    name: zodUsername,
    password: zodPassword,
})

export const setupFormSchema = zfd.formData({
    email: zfd.text(zodEmail),
    name: zfd.text(zodUsername),
    password: zfd.text(zodPassword),
})

export type SetupInput = z.infer<typeof setupSchema>

// =============================================================================
// VERIFICATION
// =============================================================================

export const verifyCodeSchema = z.object({
    code: z.string().min(4).max(10),
})

export const verifyCodeFormSchema = zfd.formData({
    code: zfd.text(z.string().min(4).max(10)),
})
