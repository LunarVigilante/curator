import type { Metadata } from "next";
import { Geist, Geist_Mono, Playfair_Display } from "next/font/google";
import { ThemeProvider } from "next-themes";
import Link from "next/link";
import { Toaster } from "sonner";
import "./globals.css";
import { PageBackground } from "@/components/ui/PageBackground";
import { PostHogProvider } from "@/components/providers/PostHogProvider";
import { Navbar } from "@/components/layout/Navbar";

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
        className={`${geistSans.variable} ${geistMono.variable} ${playfairDisplay.variable} antialiased`}
        suppressHydrationWarning
      >
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
          <PostHogProvider
            apiKey={process.env.NEXT_PUBLIC_POSTHOG_KEY}
            apiHost={process.env.NEXT_PUBLIC_POSTHOG_HOST}
          >
            <PageBackground>
              <Navbar />
              <main>
                {children}
              </main>
            </PageBackground>
            <Toaster />
          </PostHogProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
