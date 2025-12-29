import { Resend } from 'resend';
import { createClient } from '@/lib/supabase/server';
import { SystemConfigService } from './SystemConfigService';

export class EmailService {

    static async seedDefaultTemplates() {
        const supabase = await createClient();

        const defaults = [
            {
                name: 'password-reset',
                subject: 'Reset your password',
                body_html: '<p>Click <a href="{{link}}">here</a> to reset.</p>',
                variables: JSON.stringify(['{{link}}'])
            },
            {
                name: 'invite-user',
                subject: 'You have been invited!',
                body_html: '<p>Welcome to Curator. Join us <a href="{{link}}">here</a>.</p>',
                variables: JSON.stringify(['{{link}}'])
            }
        ];

        for (const template of defaults) {
            const { data: existing } = await supabase
                .from('email_templates')
                .select('id')
                .eq('name', template.name)
                .single();

            if (!existing) {
                await supabase.from('email_templates').insert(template);
                console.log(`Seeded template: ${template.name}`);
            }
        }
    }

    static async sendTransactionalEmail(to: string, templateName: string, data: Record<string, string>) {
        const supabase = await createClient();

        // 1. Fetch Template
        const { data: template, error } = await supabase
            .from('email_templates')
            .select('*')
            .eq('name', templateName)
            .single();

        if (error || !template) {
            console.error(`Email Template not found: ${templateName}`);
            // Fallback: If critical templates are missing, maybe try seeding on the fly
            if (['password-reset', 'invite-user'].includes(templateName)) {
                await this.seedDefaultTemplates();
            }
            throw new Error(`Template '${templateName}' not found.`);
        }

        // 2. Interpolate
        let subject = template.subject;
        let html = template.body_html;

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
            return;
        }

        const resend = new Resend(apiKey);

        try {
            const { data: result, error } = await resend.emails.send({
                from: 'Curator <onboarding@resend.dev>',
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
