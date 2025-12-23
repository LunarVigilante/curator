import type { Metadata } from "next";
import { Geist, Geist_Mono, Playfair_Display } from "next/font/google";
import { ThemeProvider } from "next-themes";
import Link from "next/link";
import { Toaster } from "sonner";
import "./globals.css";
import { PageBackground } from "@/components/ui/PageBackground";

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
          <PageBackground>
            <nav className="sticky top-0 z-50 border-b border-white/10 bg-black/60 backdrop-blur-[10px] supports-[backdrop-filter]:bg-black/60">
              <div className="container mx-auto flex h-16 items-center px-4">
                <div className="mr-4 hidden md:flex">
                  <Link className="mr-6 flex items-center space-x-2" href="/">
                    <span className="hidden font-serif font-bold text-xl sm:inline-block">
                      Curator
                    </span>
                  </Link>
                  <nav className="flex items-center space-x-6 text-sm font-medium">
                    <Link className="transition-colors hover:text-foreground/80 text-foreground/60" href="/items">Items</Link>
                    <Link className="transition-colors hover:text-foreground/80 text-foreground/60" href="/tags">Tags</Link>
                    <Link className="transition-colors hover:text-foreground/80 text-foreground/60" href="/settings">Settings</Link>
                  </nav>
                </div>
              </div>
            </nav>
            <main>
              {children}
            </main>
          </PageBackground>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
