import { revalidatePath } from "next/cache";
import { authorized, SECRET_HEADER } from "@/lib/auth";

// Called by scripts/promo-add.ts after a promotion upsert. The strip renders
// from the root layout, so every page carries it — the static ones (/about,
// /privacy) included — and one layout revalidation marks them all. Each cached
// page re-renders once on its next visit: roughly one R2 PUT per cached page,
// one-off per new promotion.
// Not cached: Route Handlers are dynamic by default and only GET can opt in.
export async function POST(request: Request): Promise<Response> {
  if (!authorized(request.headers.get(SECRET_HEADER))) {
    return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  revalidatePath("/", "layout");
  return Response.json({ ok: true, revalidated: ["/ (layout: every page)"] });
}
