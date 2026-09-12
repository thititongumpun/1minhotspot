import type { NextConfig } from "next";

/**
 * Report-Only on purpose. The site loads AdSense, the Facebook video plugin,
 * YouTube and Vercel analytics — a wrong directive in enforcing mode blanks the
 * ads or the embed with no local signal. Report-Only lets the browser console
 * name what is missing first. Nonces are deliberately out of scope: Next's own
 * inline JSON-LD and AdSense both need 'unsafe-inline' for script, and a nonce
 * forces every page dynamic.
 *
 * 'unsafe-eval' is NOT listed even though Google's ad stack may want it — the
 * whole point of this pass is to find out from the reports rather than guess.
 */
const CSP_REPORT_ONLY = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'self'",
  "form-action 'self'",
  "script-src 'self' 'unsafe-inline' https://pagead2.googlesyndication.com https://googleads.g.doubleclick.net https://tpc.googlesyndication.com https://*.adtrafficquality.google https://fundingchoicesmessages.google.com https://connect.facebook.net https://www.facebook.com https://va.vercel-scripts.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://thumbs.1minhotspot.com https://*.fbcdn.net https://*.facebook.com https://i.ytimg.com https://*.ggpht.com https://pagead2.googlesyndication.com https://googleads.g.doubleclick.net https://tpc.googlesyndication.com https://*.adtrafficquality.google https://picsum.photos https://fastly.picsum.photos",
  "font-src 'self' data:",
  "connect-src 'self' https://pagead2.googlesyndication.com https://googleads.g.doubleclick.net https://*.adtrafficquality.google https://fundingchoicesmessages.google.com https://www.facebook.com https://connect.facebook.net https://va.vercel-scripts.com https://vitals.vercel-insights.com",
  "frame-src https://www.facebook.com https://www.google.com https://web.facebook.com https://www.youtube.com https://www.youtube-nocookie.com https://googleads.g.doubleclick.net https://tpc.googlesyndication.com https://*.adtrafficquality.google https://fundingchoicesmessages.google.com",
  "media-src 'self' blob: https://*.fbcdn.net",
  "worker-src 'self' blob:",
].join("; ");

const nextConfig: NextConfig = {
  // Home is the "what's new" surface: a tap on หน้าแรก must fetch fresh, not
  // reuse the 5-minute client prefetch; 30s is the schema floor. Back/forward stays cached (Next ignores
  // staleTimes there on purpose, to keep scroll position).
  experimental: {
    staleTimes: { static: 30 },
    // Every prerender worker boots its own wrangler platform proxy to reach the
    // D1 binding (lib/db.ts). At the default one-worker-per-core that is 21
    // miniflare instances and the build is OOM-killed (exit 137) before the
    // store can answer, so article pages silently prerender without their
    // archive rows. Four keeps it under 2 GB.
    cpus: 4,
  },
  images: {
    unoptimized: true,
    remotePatterns: [
      { protocol: "https", hostname: "**.fbcdn.net" },
      { protocol: "https", hostname: "thumbs.1minhotspot.com" },
      // Retired store; drop once scripts/blob-thumbs.ts --apply --force has moved every row.
      { protocol: "https", hostname: "*.public.blob.vercel-storage.com" },
      { protocol: "https", hostname: "**.facebook.com" },
      { protocol: "https", hostname: "**.ggpht.com" },
      { protocol: "https", hostname: "**.ytimg.com" },
      { protocol: "https", hostname: "picsum.photos" },
      { protocol: "https", hostname: "fastly.picsum.photos" },
    ],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Minimal on purpose. `fullscreen`, `autoplay`, `encrypted-media` and
          // `picture-in-picture` are NOT denied — components/clip-embed.tsx grants
          // exactly those to the Facebook/YouTube iframe and a document-level deny
          // would override the allow attribute. `browsing-topics` is left alone too:
          // denying it would cut AdSense's Topics signal for no security gain.
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), magnetometer=(), gyroscope=(), midi=(), serial=()",
          },
          { key: "Content-Security-Policy-Report-Only", value: CSP_REPORT_ONLY },
        ],
      },
    ];
  },
};

export default nextConfig;

import('@opennextjs/cloudflare').then(m => m.initOpenNextCloudflareForDev());
