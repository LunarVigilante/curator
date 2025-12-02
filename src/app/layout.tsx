import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "next-themes";
import Link from "next/link";
import { Toaster } from "sonner";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Universal Ranking System",
  description: "Rank anything with tier lists",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        suppressHydrationWarning
      >
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
          <nav className="border-b">
            <div className="container mx-auto flex h-16 items-center px-4">
              <div className="mr-4 hidden md:flex">
                <Link className="mr-6 flex items-center space-x-2" href="/">
                  <span className="hidden font-bold sm:inline-block">
                    Ranking System
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
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
