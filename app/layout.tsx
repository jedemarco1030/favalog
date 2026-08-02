import type { Metadata, Viewport } from "next";
import { Fraunces, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";

const inter = Inter({
  variable: "--font-sans-family",
  subsets: ["latin"],
  display: "swap",
});

const fraunces = Fraunces({
  variable: "--font-display-family",
  subsets: ["latin"],
  display: "swap",
  axes: ["opsz"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono-family",
  subsets: ["latin"],
  display: "swap",
});

const siteUrl = "https://lorely.app";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Lorely — Everything you watch and read",
    template: "%s · Lorely",
  },
  description:
    "Lorely is a social home for everything you watch and read. Track films, series, and books, rate them, review them, and remember them.",
  applicationName: "Lorely",
  keywords: [
    "movies",
    "tv shows",
    "books",
    "reviews",
    "tracking",
    "social",
    "letterboxd",
    "goodreads",
  ],
  authors: [{ name: "Lorely" }],
  openGraph: {
    type: "website",
    url: siteUrl,
    title: "Lorely — Everything you watch and read",
    description:
      "One social home for everything you watch and read. Films, series, and books.",
    siteName: "Lorely",
  },
  twitter: {
    card: "summary_large_image",
    title: "Lorely — Everything you watch and read",
    description:
      "One social home for everything you watch and read. Films, series, and books.",
  },
};

export const viewport: Viewport = {
  themeColor: "#0b0b0f",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${fraunces.variable} ${jetbrainsMono.variable}`}
    >
      <body className="flex min-h-dvh flex-col bg-background text-foreground antialiased">
        <SiteHeader />
        <main className="flex-1">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
