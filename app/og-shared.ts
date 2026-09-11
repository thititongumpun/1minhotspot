import { OG_FALLBACK_FONT_BASE64 } from "./og-fallback-font";

// Shared by the opengraph-image.tsx routes only. Not a page/route segment itself.

// Hex equivalents of the OKLCH tokens in app/globals.css — satori (the
// renderer behind next/og's ImageResponse) doesn't reliably parse oklch(),
// so these are pre-converted once here rather than per-image.
export const OG_COLORS = {
  ink: "#090c12",
  surface: "#13171f",
  hairline: "#2f343e",
  fg: "#f4f6f8",
  muted: "#9fa3ac",
  hot: "#fc8c00",
  hotDeep: "#c65500",
} as const;

/**
 * Latin-only face bundled at build time (not read from the filesystem, so this
 * works on runtimes with no fs access, e.g. Cloudflare Workers). Used only when
 * Google Fonts is unreachable: an OG image with Latin fallback type beats a
 * broken route, and beats an unhandled rejection taking the whole server down.
 */
function latinFallbackFont(): ArrayBuffer {
  const binary = atob(OG_FALLBACK_FONT_BASE64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

/**
 * Fetches a Google Fonts family as a single ArrayBuffer covering both Latin
 * and Thai glyphs. Requesting with a legacy user-agent makes Google skip the
 * unicode-range split it normally serves to modern browsers, so we get back
 * one @font-face / one file with the full glyph set — exactly what satori
 * needs (it can't merge multiple subset files, and can't parse woff2).
 *
 * Never rejects. Callers kick this off at module scope, where a rejected
 * promise with no handler yet attached terminates the Node process.
 */
export async function loadThaiFont(family: string, weight: number): Promise<ArrayBuffer> {
  try {
    const cssUrl = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@${weight}&display=swap`;
    const css = await fetch(cssUrl, {
      headers: {
        // An old Safari UA: no unicode-range/woff2 support, so Google replies
        // with a single legacy woff file that bundles every subset.
        "User-Agent":
          "Mozilla/5.0 (Windows NT 6.1) AppleWebKit/534.24 (KHTML, like Gecko) Chrome/11.0.696.71 Safari/534.24",
      },
    }).then((res) => res.text());

    const match = css.match(/src: url\(([^)]+)\) format\('(?:woff|truetype|opentype)'\)/);
    if (!match) {
      throw new Error(`no font file in Google Fonts CSS for ${family} ${weight}`);
    }
    return await fetch(match[1]).then((res) => res.arrayBuffer());
  } catch (err) {
    console.error(`[og] ${family} ${weight} unavailable, falling back to Latin-only type:`, err);
    return latinFallbackFont();
  }
}
