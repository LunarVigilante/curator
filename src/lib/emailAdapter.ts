/**
 * Email Adapter for Better-Auth
 * 
 * This module provides email sending functions that can be injected into
 * the auth configuration. It handles fetching email configuration from
 * the database, eliminating the need for the auth config to directly
 * depend on SystemConfigService.
 */

import { Resend } from 'resend';
import { render } from '@react-email/render';
import { ResetPasswordEmail } from '@/emails/ResetPasswordEmail';
import { VerifyEmail } from '@/emails/VerifyEmail';

/**
 * Get email configuration from database or environment.
 * Uses dynamic import to avoid circular dependencies.
 */
async function getEmailConfig(): Promise<{ resendKey: string | null; fromEmail: string }> {
    // Dynamic import to break circular dependency
    const { SystemConfigService } = await import('./services/SystemConfigService');

    const resendKey = await SystemConfigService.getDecryptedConfig('resend_api_key')
        || process.env.RESEND_API_KEY
        || null;

    const fromEmail = await SystemConfigService.getDecryptedConfig('resend_from_email')
        || 'Curator <system@resend.dev>';

    return { resendKey, fromEmail };
}

/**
 * Send password reset email.
 * Designed to be used as better-auth's sendResetPassword callback.
 */
export async function sendPasswordResetEmail({ user, url }: { user: { email: string }; url: string }): Promise<void> {
    const { resendKey, fromEmail } = await getEmailConfig();

    if (!resendKey) {
        console.error("[EmailAdapter] Resend API key not found. Cannot send reset email.");
        return;
    }

    const resend = new Resend(resendKey);
    const emailHtml = await render(
        ResetPasswordEmail({
            resetLink: url,
            userEmail: user.email
        })
    );

    try {
        const { error } = await resend.emails.send({
            from: fromEmail,
            to: user.email,
            subject: 'Reset your password',
            html: emailHtml,
        });

        if (error) {
            console.error("[EmailAdapter] Resend Error:", error);
        }
    } catch (err) {
        console.error("[EmailAdapter] Email sending failed:", err);
    }
}

/**
 * Send email verification.
 * Designed to be used as better-auth's sendVerificationEmail callback.
 */
export async function sendVerificationEmail({ user, url }: { user: { email: string }; url: string }): Promise<void> {
    const { resendKey, fromEmail } = await getEmailConfig();

    if (!resendKey) {
        console.error("[EmailAdapter] Resend API key not found. Cannot send verification email.");
        return;
    }

    const resend = new Resend(resendKey);
    const emailHtml = await render(
        VerifyEmail({
            verifyLink: url,
            userEmail: user.email
        })
    );

    try {
        const { error } = await resend.emails.send({
            from: fromEmail,
            to: user.email,
            subject: 'Welcome to Curator - Verify your email',
            html: emailHtml,
        });

        if (error) {
            console.error("[EmailAdapter] Resend Verification Error:", error);
        }
    } catch (err) {
        console.error("[EmailAdapter] Email verification sending failed:", err);
    }
}

/**
 * Send email change verification.
 * Used when a user requests to change their email address.
 */
export async function sendEmailChangeVerification({ email, code }: { email: string; code: string }): Promise<void> {
    const { resendKey, fromEmail } = await getEmailConfig();

    if (!resendKey) {
        console.error("[EmailAdapter] Resend API key not found. Cannot send email change verification.");
        return;
    }

    const resend = new Resend(resendKey);

    // Simple email for email change verification
    const emailHtml = `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1 style="color: #3b82f6;">Verify Your New Email</h1>
            <p>You requested to change your email address on Curator. Use the code below to verify this email:</p>
            <div style="background: #f4f4f5; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0;">
                <span style="font-size: 32px; font-weight: bold; letter-spacing: 4px; color: #18181b;">${code}</span>
            </div>
            <p>This code expires in 24 hours.</p>
            <p style="color: #71717a; font-size: 12px;">If you didn't request this change, you can safely ignore this email.</p>
        </div>
    `;

    try {
        const { error } = await resend.emails.send({
            from: fromEmail,
            to: email,
            subject: 'Curator - Verify your new email address',
            html: emailHtml,
        });

        if (error) {
            console.error("[EmailAdapter] Resend Email Change Error:", error);
        }
    } catch (err) {
        console.error("[EmailAdapter] Email change verification sending failed:", err);
    }
}

/**
 * Send two-factor authentication OTP email.
 * Used during login when 2FA is enabled.
 */
export async function sendTwoFactorEmail({ email, code }: { email: string; code: string }): Promise<void> {
    const { resendKey, fromEmail } = await getEmailConfig();

    if (!resendKey) {
        console.error("[EmailAdapter] Resend API key not found. Cannot send 2FA email.");
        throw new Error("Email service not configured");
    }

    const resend = new Resend(resendKey);

    const emailHtml = `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1 style="color: #3b82f6;">Your Login Verification Code</h1>
            <p>Enter this code to complete your sign-in to Curator:</p>
            <div style="background: linear-gradient(135deg, #1e1b4b 0%, #312e81 100%); padding: 24px; border-radius: 12px; text-align: center; margin: 24px 0;">
                <span style="font-size: 40px; font-weight: bold; letter-spacing: 12px; color: #ffffff;">${code}</span>
            </div>
            <p style="color: #71717a; font-size: 14px;">This code expires in 10 minutes.</p>
            <hr style="border: none; border-top: 1px solid #e4e4e7; margin: 24px 0;" />
            <p style="color: #ef4444; font-size: 12px;">
                <strong>Security Notice:</strong> If you didn't try to sign in, someone may be attempting to access your account. 
                Please change your password immediately.
            </p>
        </div>
    `;

    const { error } = await resend.emails.send({
        from: fromEmail,
        to: email,
        subject: 'Curator - Your verification code',
        html: emailHtml,
    });

    if (error) {
        console.error("[EmailAdapter] Resend 2FA Error:", error);
        throw new Error("Failed to send verification email");
    }
}
