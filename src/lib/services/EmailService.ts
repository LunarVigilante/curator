import { Resend } from 'resend';
import { db } from '@/lib/db';
import { emailTemplates } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { SystemConfigService } from './SystemConfigService';

// Removed global init because we fetch key dynamically per request
// const resend = new Resend(process.env.RESEND_API_KEY);

export class EmailService {

    static async seedDefaultTemplates() {
        const defaults = [
            {
                name: 'password-reset',
                subject: 'Reset your password',
                bodyHtml: '<p>Click <a href="{{link}}">here</a> to reset.</p>',
                variables: JSON.stringify(['{{link}}'])
            },
            {
                name: 'invite-user',
                subject: 'You have been invited!',
                bodyHtml: '<p>Welcome to Curator. Join us <a href="{{link}}">here</a>.</p>',
                variables: JSON.stringify(['{{link}}'])
            }
        ];

        for (const template of defaults) {
            const existing = await db.select().from(emailTemplates).where(eq(emailTemplates.name, template.name)).limit(1);

            if (existing.length === 0) {
                await db.insert(emailTemplates).values(template);
                console.log(`Seeded template: ${template.name}`);
            }
        }
    }

    static async sendTransactionalEmail(to: string, templateName: string, data: Record<string, string>) {
        // 1. Fetch Template
        const templates = await db.select().from(emailTemplates).where(eq(emailTemplates.name, templateName)).limit(1);

        if (templates.length === 0) {
            console.error(`Email Template not found: ${templateName}`);
            // Fallback: If critical templates are missing, maybe try seeding on the fly or throw error.
            // For now, let's auto-seed safely if it was supposed to be a default
            if (['password-reset', 'invite-user'].includes(templateName)) {
                await this.seedDefaultTemplates();
                // Retry fetch? Or just throw and let retry logic handle it?
                // Throwing is safer than infinite loops.
            }
            throw new Error(`Template '${templateName}' not found.`);
        }

        const template = templates[0];

        // 2. Interpolate
        let subject = template.subject;
        let html = template.bodyHtml;

        for (const [key, value] of Object.entries(data)) {
            const placeholder = `{{${key}}}`;
            // Global replace
            subject = subject.split(placeholder).join(value);
            html = html.split(placeholder).join(value);
        }

        // 3. Send via Resend
        const apiKey = await SystemConfigService.getDecryptedConfig('resend_api_key');

        if (!apiKey) {
            console.warn("RESEND_API_KEY not configured in System Settings. Email simulation:", { to, subject });
            // Optionally throw error here if strictness is required
            return;
        }

        const resend = new Resend(apiKey);

        try {
            const { data: result, error } = await resend.emails.send({
                from: 'Curator <onboarding@resend.dev>', // Default testing domain. Change to your verified domain in prod.
                to: [to],
                subject: subject,
                html: html,
            });

            if (error) {
                console.error("Resend Error:", error);
                throw new Error(error.message);
            }

            return result;
        } catch (err) {
            console.error("Failed to send email:", err);
            throw err;
        }
    }

    static async sendTestEmail(to: string) {
        const apiKey = await SystemConfigService.getDecryptedConfig('resend_api_key');
        if (!apiKey) {
            console.warn("RESEND_API_KEY not configured. Test email simulation:", { to });
            return;
        }

        const resend = new Resend(apiKey);

        try {
            await resend.emails.send({
                from: 'Curator <onboarding@resend.dev>',
                to: [to],
                subject: 'Test Email from Curator',
                html: '<p>This is a test email from your Curator system configuration.</p>',
            });
        } catch (err) {
            console.error("Failed to send test email:", err);
            throw err;
        }
    }
}
