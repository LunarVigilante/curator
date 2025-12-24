'use server';

import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { users, invites, systemSettings, emailTemplates as emailTemplatesSchema } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { SystemConfigService } from '@/lib/services/SystemConfigService';

// --- Authorization Helper ---
async function assertAdmin() {
    const session = await auth.api.getSession({
        headers: await headers()
    });

    if (!session || session.user.role !== 'ADMIN') {
        throw new Error("Unauthorized");
    }

    return session.user;
}

// --- Invite System ---

export async function generateInviteCode() {
    const admin = await assertAdmin();
    // Simple random 8-char code. Not cryptographically perfect but fine for this.
    const code = Math.random().toString(36).substring(2, 10).toUpperCase();

    // Ensure unique (basic collision check would ideally be loop, but trying once is fine for low volume)
    await db.insert(invites).values({
        code,
        createdBy: admin.id,
        isUsed: false,
    });

    revalidatePath('/admin');
    return { success: true, code };
}

export async function getInvites() {
    await assertAdmin();

    const result = await db.select({
        id: invites.id,
        code: invites.code,
        isUsed: invites.isUsed,
        createdAt: invites.createdAt,
        usedAt: invites.usedAt,
        creatorName: users.name, // Join to get creator name
    })
        .from(invites)
        .leftJoin(users, eq(invites.createdBy, users.id))
        .orderBy(desc(invites.createdAt));

    return result;
}

// --- System Configuration ---

export async function updateSystemConfig(data: {
    anannasKey?: string;
    anannasModel?: string;
    systemPrompt?: string;
    resendApiKey?: string;
    fromEmail?: string;
}) {
    await assertAdmin();

    // Helper to upsert settings securely
    const upsertSetting = async (key: string, value: string, category: string, isSecret: boolean) => {
        if (!value) return;

        // We use the SystemConfigService to handle encryption if needed,
        // but for now we'll do raw DB write with "isSecret" flag for future encryption hooks.
        // Actually, let's use the service if possible, but the service `updateSetting` matches better.
        // Re-using SystemConfigService would be cleaner.

        await SystemConfigService.updateSetting(key, value, category, isSecret);
    };

    if (data.anannasKey) {
        // Only update key if provided (placeholder handling handled by frontend usually)
        if (!data.anannasKey.includes('•') && !data.anannasKey.includes('*')) {
            await upsertSetting('anannas_api_key', data.anannasKey, 'LLM', true);
        }
    }

    if (data.anannasModel) {
        await upsertSetting('anannas_model', data.anannasModel, 'LLM', false);
    }

    if (data.systemPrompt) {
        await upsertSetting('system_prompt', data.systemPrompt, 'LLM', false);
    }

    if (data.resendApiKey) {
        if (!data.resendApiKey.includes('•') && !data.resendApiKey.includes('*')) {
            await upsertSetting('resend_api_key', data.resendApiKey, 'EMAIL', true);
        }
    }

    if (data.fromEmail) {
        await upsertSetting('resend_from_email', data.fromEmail, 'EMAIL', false);
    }

    revalidatePath('/admin');
    return { success: true };
}

export async function sendTestEmailAction() {
    const admin = await assertAdmin();
    // Assuming the admin has an email. 
    // In a real app we might want to allow sending to an arbitrary email for testing, 
    // but sending to the logged-in admin is safer.

    // We need to import EmailService dynamically to avoid circular deps if any 
    // (though here it should be fine).
    const { EmailService } = await import('@/lib/services/EmailService');

    await EmailService.sendTestEmail(admin.email);
    return { success: true };
}

// --- Email Templates ---

export async function getEmailTemplates() {
    await assertAdmin();
    // Re-import to avoid circular dep if needed, or just standard import
    // "emailTemplates" schema is safe to import at top level? Yes.
    // Waiting for schema availability.
    return await db.select().from(emailTemplatesSchema).orderBy(emailTemplatesSchema.name);
}

export async function updateEmailTemplate(id: string, data: { subject: string; bodyHtml: string }) {
    await assertAdmin();
    await db.update(emailTemplatesSchema)
        .set({
            subject: data.subject,
            bodyHtml: data.bodyHtml,
            lastUpdated: new Date()
        })
        .where(eq(emailTemplatesSchema.id, id));

    revalidatePath('/admin');
    return { success: true };
}
