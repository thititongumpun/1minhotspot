import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { absoluteUrl, siteUrl, SITE_DESCRIPTION } from "@/lib/seo";
import { fontVars } from "./fonts";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import "./globals.css";

// Cloudflare Web Analytics token, created per-site in the Cloudflare dashboard
// (Analytics & Logs > Web Analytics). Unset in Vercel/local, so the beacon
// only renders once this env var is configured for the Workers deployment.
const CF_BEACON_TOKEN = process.env.NEXT_PUBLIC_CF_BEACON_TOKEN;

export const metadata: Metadata = {
  // Next's production fallback is VERCEL_PROJECT_PRODUCTION_URL (the *.vercel.app
  // host), not our domain, so every og:image would resolve to the wrong origin
  // unless metadataBase is set explicitly.
  metadataBase: new URL(siteUrl()),
  title: {
    default: "ข่าววันนี้ทุกหมวด | สรุปข่าวร้อนใน 1 นาที",
    template: "%s | สรุปข่าวร้อนใน 1 นาที",
  },
  description: SITE_DESCRIPTION,
  // fb:app_id — a Meta app id (developers.facebook.com), not the page id. Only
  // Facebook's debugger cares; unset just leaves the tag out.
  facebook: process.env.NEXT_PUBLIC_FB_APP_ID ? { appId: process.env.NEXT_PUBLIC_FB_APP_ID } : undefined,
  // public/logo.png, not the app/icon.png file convention: that route is served
  // with a build hash, so this keeps the one icon crawlers see on a stable,
  // unhashed URL (the same file app/manifest.ts already points at).
  // apple is re-stated because setting `icons` at all drops the app/apple-icon.png
  // convention's own <link>; the file (and its route) still serves it.
  icons: {
    icon: [{ url: "/logo.png", sizes: "512x512", type: "image/png" }],
    apple: [{ url: "/apple-icon.png", sizes: "180x180", type: "image/png" }],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
};

// Browser chrome follows the page ground in each scheme.
export const viewport: Viewport = {
  colorScheme: "light dark",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f9f6f1" },
    { media: "(prefers-color-scheme: dark)", color: "#090c12" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="th" className={`h-full antialiased ${fontVars}`}>
      <body className="min-h-full flex flex-col">
        {/* A plain element, not metadata.alternates: every page sets
            alternates.canonical, and Next replaces the whole `alternates`
            object per page rather than merging it — the layout-level entry
            never rendered. React hoists this into <head>. */}
        <link
          rel="alternate"
          type="application/rss+xml"
          title="สรุปข่าวร้อนใน 1 นาที"
          href={absoluteUrl("/feed.xml")}
        />
        <a href="#content" className="skip-link">
          ข้ามไปยังเนื้อหา
        </a>
        <SiteHeader />
        <main id="content" className="flex-1">
          {children}
        </main>
        {/* AdSense: site verification, Auto ads once approved, and Google's
            consent message (Privacy & messaging) for EEA/UK/CH visitors all
            ride on this one tag. afterInteractive keeps it off the critical
            path. */}
        <Script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-4998059744687395"
          crossOrigin="anonymous"
          strategy="afterInteractive"
        />
        {CF_BEACON_TOKEN && (
          <Script
            src="https://static.cloudflareinsights.com/beacon.min.js"
            data-cf-beacon={`{"token": "${CF_BEACON_TOKEN}"}`}
            strategy="afterInteractive"
          />
        )}
        <SiteFooter />
      </body>
    </html>
  );
}
