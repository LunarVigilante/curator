import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";
import "./globals.css";
import { AntigravityBackground } from "@/components/ui/AntigravityBackground";
import { Navbar } from "@/components/layout/Navbar";
import { PasswordResetGuard } from "@/components/auth/PasswordResetGuard";
import { GlobalNoiseFilter } from "@/components/ui/GlobalNoiseFilter";
import { AxiomWebVitals } from 'next-axiom';

const geistSans = Geist({
  variable: "--font-geist-sans",
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
        className={`${geistSans.variable} antialiased min-h-screen bg-black text-white`}
        suppressHydrationWarning
      >
        <AxiomWebVitals />
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
          <GlobalNoiseFilter />
          <PasswordResetGuard />

          {/* 1. Global Background (The Base) */}
          <AntigravityBackground className="fixed inset-0 z-0" />

          {/* 2. Main Content Wrapper */}
          <div className="relative z-10 flex flex-col min-h-screen">
            <Navbar />
            <main className="flex-1">
              {children}
            </main>
          </div>

          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}

