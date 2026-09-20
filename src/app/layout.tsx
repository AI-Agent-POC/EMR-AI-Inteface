import type { Metadata, Viewport } from "next";
import { DM_Sans, Sora, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/shell/theme-provider";
import { AppShell } from "@/components/shell/app-shell";
import { Toaster } from "@/components/ui/sonner";

// DM Sans for reading, Sora for the one display line on the landing screen, JetBrains
// Mono for SQL and figures. Loaded by next/font so there is no flash of fallback.
const sans = DM_Sans({ variable: "--font-dm-sans", subsets: ["latin"], weight: ["400", "500", "600", "700"] });
const display = Sora({ variable: "--font-sora", subsets: ["latin"], weight: ["300", "400", "500", "600"] });
const mono = JetBrains_Mono({ variable: "--font-jetbrains", subsets: ["latin"], weight: ["400", "500", "600"] });

// Absolute URLs are required for share previews. Set NEXT_PUBLIC_SITE_URL to the
// deployed origin; without it the cards still build, but only resolve locally.
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
const description =
  "Ask your ClinicSoft 9.0 clinic database anything in plain English — revenue, claims, " +
  "no-shows, stock and compliance — answered under your own read-only permissions.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "ClinicSoft Agent",
    template: "%s · ClinicSoft Agent",
  },
  description,
  applicationName: "ClinicSoft Agent",
  authors: [{ name: "Pronttera" }],
  keywords: ["ClinicSoft", "EMR", "AI agent", "clinic analytics", "UAE healthcare", "text to SQL"],
  openGraph: {
    type: "website",
    siteName: "ClinicSoft Agent",
    title: "Ask the practice anything",
    description,
    url: siteUrl,
    locale: "en_AE",
  },
  twitter: {
    card: "summary_large_image",
    title: "Ask the practice anything",
    description,
  },
  robots: { index: false, follow: false },   // a client demo, not a public site
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0d15" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning
          className={`${sans.variable} ${display.variable} ${mono.variable} h-full antialiased`}>
      <body className="min-h-full bg-background text-foreground">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <AppShell>{children}</AppShell>
          <Toaster richColors position="bottom-right" />
        </ThemeProvider>
      </body>
    </html>
  );
}
