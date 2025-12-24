import type { Metadata } from "next";
import { Geist, Geist_Mono, Playfair_Display } from "next/font/google";
import { ThemeProvider } from "next-themes";
import Link from "next/link";
import { Toaster } from "sonner";
import "./globals.css";
import { AmbientBackground } from "@/components/ui/AmbientBackground";
import { PostHogProvider } from "@/components/providers/PostHogProvider";
import { Navbar } from "@/components/layout/Navbar";
import { PasswordResetGuard } from "@/components/auth/PasswordResetGuard";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const playfairDisplay = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Curator",
  description: "A universal ranking and rating system for organizing anything",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${playfairDisplay.variable} antialiased min-h-screen bg-black text-white`}
        suppressHydrationWarning
      >
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
          <PostHogProvider
            apiKey={process.env.NEXT_PUBLIC_POSTHOG_KEY}
            apiHost={process.env.NEXT_PUBLIC_POSTHOG_HOST}
          >
            <PasswordResetGuard />

            {/* 1. Global Background (The Base) */}
            <AmbientBackground className="fixed inset-0 z-0" />

            {/* 2. Main Content Wrapper */}
            <div className="relative z-10 flex flex-col min-h-screen">
              <Navbar />
              <main className="flex-1">
                {children}
              </main>
            </div>

            <Toaster />
          </PostHogProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
