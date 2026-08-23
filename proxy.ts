import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * `/news/[slug]` and `/category/[category]` both guard their own
 * `decodeURIComponent` call (see lib/clips.ts getClip) — but that guard never
 * runs. Next decodes dynamic route params internally before page code
 * executes, and a malformed percent-escape (`/news/%%%%`) makes THAT decode
 * throw, uncaught, turning what should be a 404 into a 500.
 *
 * Proxy runs before routing, so it sees the raw, still-encoded pathname.
 * Rewrite a malformed last segment to a syntactically valid one that matches
 * nothing real — that flows through the ordinary "not found" path (the
 * page's own lookup returns null/undefined and calls notFound()) instead of
 * crashing before any page code runs.
 */
export function proxy(request: NextRequest) {
  try {
    const { pathname } = request.nextUrl;
    decodeURIComponent(pathname);
  } catch {
    console.error("[proxy] malformed percent-escape, returning 404:", request.nextUrl.pathname);
    return new NextResponse(null, { status: 404 });
  }
}

export const config = {
  matcher: ["/news/:path*", "/category/:path*"],
};
