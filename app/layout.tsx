import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { absoluteUrl, siteUrl, SITE_DESCRIPTION, SITE_NAME } from "@/lib/seo";
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
  // Site-wide defaults; pages that call pageOpenGraph() override openGraph.
  openGraph: { type: "website", siteName: SITE_NAME, locale: "th_TH" },
  twitter: { card: "summary_large_image" },
  // fb:app_id — a Meta app id (developers.facebook.com), not the page id. Only
  // Facebook's debugger cares; unset just leaves the tag out.
  facebook: process.env.NEXT_PUBLIC_FB_APP_ID ? { appId: process.env.NEXT_PUBLIC_FB_APP_ID } : undefined,
  // public/logo-96.png, not the app/icon.png file convention: that route is
  // served with a build hash, so this keeps the one icon crawlers see on a
  // stable, unhashed URL. 96px (a multiple of Google's 48px) — the 512px
  // logo.png is 96 KB and every new visitor was downloading it as the favicon;
  // manifest.ts and the JSON-LD publisher logo still point at the 512.
  // apple is re-stated because setting `icons` at all drops the app/apple-icon.png
  // convention's own <link>; the file (and its route) still serves it.
  icons: {
    icon: [{ url: "/logo-96.png", sizes: "96x96", type: "image/png" }],
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
        {/* Every hero and card still comes from the thumbs host; warm it in the
            first wave instead of paying DNS+TLS when the LCP request starts. */}
        <link rel="preconnect" href={`https://${process.env.R2_PUBLIC_HOST || "thumbs.1minhotspot.com"}`} />
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
            ride on this one tag. lazyOnload: on a slow phone the 220 KB tag
            was downloading beside the hero still and pushed LCP past 6 s;
            after `load` it costs the LCP nothing and ads still fill. */}
        <Script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-4998059744687395"
          crossOrigin="anonymous"
          strategy="lazyOnload"
        />
        {CF_BEACON_TOKEN && (
          <Script
            src="https://static.cloudflareinsights.com/beacon.min.js"
            data-cf-beacon={`{"token": "${CF_BEACON_TOKEN}"}`}
            strategy="lazyOnload"
          />
        )}
        <SiteFooter />
      </body>
    </html>
  );
}
