import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, Inter, Source_Serif_4 } from "next/font/google";
import type { ReactNode } from "react";
import { Toaster } from "@/components/ui/sonner";
import { site } from "@/config/site";
import { appUrl } from "@/env";
import "./globals.css";

/*
 * Fonts (DESIGN.md §4), self-hosted by next/font — no request to Google at run time.
 * The CSS variables are mapped to --font-sans / --font-display / --font-mono in globals.css.
 */
const inter = Inter({ subsets: ["latin"], display: "swap", variable: "--font-inter" });
const sourceSerif = Source_Serif_4({ subsets: ["latin"], display: "swap", variable: "--font-source-serif", axes: ["opsz"] });
const plexMono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500"], display: "swap", variable: "--font-plex-mono" });

const title = `${site.name} — ${site.tagline}`;

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: { default: title, template: `%s · ${site.name}` },
  description: site.description,
  applicationName: site.name,
  openGraph: {
    type: "website",
    siteName: site.name,
    title,
    description: site.description,
    url: "/",
    locale: "en_GB",
  },
  twitter: { card: "summary_large_image", title, description: site.description },
  alternates: { canonical: "/" },
  formatDetection: { telephone: false, address: false, email: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#FAF8F3",
  colorScheme: "light",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    /*
     * data-scroll-behavior: globals.css makes in-page anchors glide (scroll-behavior: smooth).
     * With this attribute the router switches that off while it moves to another page, so a new
     * page opens at its top at once. Without it the router's own scroll is animated too, its
     * steps overtake one another, and the page ends at a later section (docs: upgrading to
     * version 16, "scroll behavior override"). Guarded by scripts/design/controls.mjs.
     */
    <html lang={site.locale} data-scroll-behavior="smooth" className={`${inter.variable} ${sourceSerif.variable} ${plexMono.variable}`}>
      <body className="min-h-dvh">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-control focus:bg-ink focus:px-4 focus:py-3 focus:text-sm focus:font-medium focus:text-paper focus:shadow-overlay"
        >
          Skip to content
        </a>
        {children}
        <Toaster position="top-center" closeButton />
      </body>
    </html>
  );
}
