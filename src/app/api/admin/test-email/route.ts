import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { SystemConfigService } from '@/lib/services/SystemConfigService';

export async function POST(request: NextRequest) {
    try {
        const { recipient, apiKey } = await request.json();

        if (!recipient) {
            return NextResponse.json(
                { success: false, error: 'Missing recipient email' },
                { status: 400 }
            );
        }

        // Get the real API key - use passed key if not masked, otherwise fetch from DB
        let realApiKey = apiKey;
        if (!apiKey || apiKey.includes('*') || apiKey.includes('•')) {
            realApiKey = await SystemConfigService.getDecryptedConfig('resend_api_key');
        }

        if (!realApiKey) {
            return NextResponse.json(
                { success: false, error: 'No Resend API key configured' },
                { status: 400 }
            );
        }

        // Get the from email from config
        const fromEmail = await SystemConfigService.getDecryptedConfig('resend_from_email') || 'onboarding@resend.dev';

        const resend = new Resend(realApiKey);

        const { data, error } = await resend.emails.send({
            from: `Curator <${fromEmail}>`,
            to: [recipient],
            subject: '🎨 Curator - Test Email Configuration',
            html: `
                <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; background: #18181b; color: #fafafa; padding: 32px; border-radius: 8px;">
                    <h1 style="color: #3b82f6; margin-bottom: 24px;">✅ Email Configuration Verified!</h1>
                    <p style="color: #a1a1aa; line-height: 1.6;">
                        Congratulations! Your Resend email integration is working correctly.
                    </p>
                    <p style="color: #a1a1aa; line-height: 1.6;">
                        This is a test email sent from your Curator admin panel to verify that transactional emails are configured properly.
                    </p>
                    <div style="background: #27272a; padding: 16px; border-radius: 6px; margin-top: 24px;">
                        <p style="color: #71717a; font-size: 12px; margin: 0;">
                            Sent from: ${fromEmail}<br/>
                            Sent at: ${new Date().toISOString()}
                        </p>
                    </div>
                </div>
            `
        });

        if (error) {
            return NextResponse.json(
                { success: false, error: error.message },
                { status: 400 }
            );
        }

        return NextResponse.json({
            success: true,
            message: `Test email sent successfully to ${recipient}`,
            id: data?.id
        });

    } catch (error: any) {
        console.error('Test email error:', error);
        return NextResponse.json(
            { success: false, error: error.message || 'Failed to send test email' },
            { status: 500 }
        );
    }
}

