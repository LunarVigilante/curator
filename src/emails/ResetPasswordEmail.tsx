/**
 * REMINDER: Verify your sending domain in the Resend dashboard (https://resend.com/domains)
 * to prevent emails from bouncing or going to spam.
 */
import * as React from 'react';
import {
    Body,
    Container,
    Head,
    Heading,
    Html,
    Link,
    Preview,
    Text,
    Section,
    Tailwind,
} from '@react-email/components';

interface ResetPasswordEmailProps {
    resetLink: string;
    userEmail: string;
}

export const ResetPasswordEmail = ({
    resetLink = 'http://localhost:3000/auth/reset-password?token=example',
    userEmail = 'user@example.com',
}: ResetPasswordEmailProps) => {
    return (
        <Html>
            <Tailwind>
                <Head />
                <Preview>Reset your password for Curator</Preview>
                <Body className="bg-white font-sans">
                    <Container className="mx-auto py-10 px-4 max-w-lg">
                        {/* Logo or App Name */}
                        <Section className="mb-6 text-center">
                            <Heading className="text-2xl font-bold text-gray-900">
                                Curator
                            </Heading>
                        </Section>

                        {/* Main Card */}
                        <Section className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
                            <Heading className="text-xl font-semibold text-gray-800 mb-4">
                                Forgot your password?
                            </Heading>
                            <Text className="text-gray-600 mb-6">
                                We received a request to reset the password for
                                <span className="font-semibold text-gray-900"> {userEmail}</span>.
                                If you didn't make this request, you can safely ignore this email.
                            </Text>

                            {/* Action Button */}
                            <Link
                                href={resetLink}
                                className="bg-blue-600 text-white font-bold py-3 px-6 rounded-md hover:bg-blue-700 no-underline inline-block"
                            >
                                Reset Password
                            </Link>

                            <Text className="text-gray-400 text-xs mt-3">
                                This link will expire in 1 hour.
                            </Text>

                            <Text className="text-gray-400 text-sm mt-8 border-t border-gray-100 pt-6">
                                Or copy and paste this link into your browser:
                            </Text>
                            <Link href={resetLink} className="text-blue-500 text-sm break-all">
                                {resetLink}
                            </Link>
                        </Section>

                        {/* Footer */}
                        <Text className="text-center text-gray-400 text-xs mt-8">
                            &copy; {new Date().getFullYear()} Curator. All rights reserved.
                        </Text>
                    </Container>
                </Body>
            </Tailwind>
        </Html>
    );
};

export default ResetPasswordEmail;
