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
    Tailwind,
    Section
} from '@react-email/components';

interface VerifyEmailProps {
    verifyLink: string;
    userEmail: string;
}

export const VerifyEmail = ({
    verifyLink = 'http://localhost:3000/verify?token=example',
    userEmail = 'newuser@example.com',
}: VerifyEmailProps) => {
    return (
        <Html>
            <Tailwind>
                <Head />
                <Preview>Welcome to Curator! Please verify your email.</Preview>
                <Body className="bg-white font-sans">
                    <Container className="mx-auto py-10 px-4 max-w-lg">
                        <Section className="mb-6 text-center">
                            <Heading className="text-2xl font-bold text-gray-900">Curator</Heading>
                        </Section>

                        <Section className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
                            <Heading className="text-xl font-semibold text-gray-800 mb-4">
                                Verify your email address
                            </Heading>
                            <Text className="text-gray-600 mb-6">
                                Welcome! You (or someone using <strong>{userEmail}</strong>) have signed up for Curator.
                                Click the button below to verify your account and set your password.
                            </Text>

                            <Link
                                href={verifyLink}
                                className="bg-blue-600 text-white font-bold py-3 px-6 rounded-md hover:bg-blue-700 no-underline inline-block"
                            >
                                Verify & Set Password
                            </Link>

                            <Text className="text-gray-400 text-sm mt-6">
                                Link expires in 24 hours. If you didn't request this, you can ignore this email.
                            </Text>
                        </Section>

                        <Text className="text-center text-gray-400 text-xs mt-8">
                            &copy; {new Date().getFullYear()} Curator.
                        </Text>
                    </Container>
                </Body>
            </Tailwind>
        </Html>
    );
};

export default VerifyEmail;
