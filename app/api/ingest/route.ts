import { timingSafeEqual } from "node:crypto";
import { revalidatePath } from "next/cache";
import { getStoredSlugById, upsertScript, type ScriptInput } from "@/lib/store";

// Caching: nothing to opt out of. Next 16 does not cache Route Handlers by
// default, and only `GET` can ever opt in — see
// node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md.
// `export const dynamic` is removed under Cache Components
// (03-file-conventions/02-route-segment-config/index.md, v16.0.0), so it would
// be dead config today and a lie tomorrow. This handler reads request headers
// and body, which are request-time APIs, so prerendering cannot reach it.

const SECRET_HEADER = "x-ingest-secret";
const MAX_BODY_BYTES = 64 * 1024;

const json = (body: unknown, status: number) => Response.json(body, { status });
const fail = (status: number, error: string) => json({ ok: false, error }, status);

/**
 * Constant-time secret check. Fails closed: with INGEST_SECRET unset every
 * request is rejected — there is no default and no unauthenticated write path.
 * The length guard is required because timingSafeEqual throws on unequal
 * lengths; it leaks only the secret's length, which is not the secret.
 */
function authorized(provided: string | null): boolean {
  const expected = process.env.INGEST_SECRET;
  if (!expected || !provided) return false;
  const a = Buffer.from(provided, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/** Non-empty string or null — the only string shape this endpoint accepts. */
const str = (v: unknown): string | null => (typeof v === "string" && v.trim() !== "" ? v : null);

/**
 * n8n publishes a reel, then sends its Thai rewrite here.
 *
 * Only the rewrite: everything else about a clip (title, duration, thumbnail,
 * embed, permalink) is read from the Facebook /videos edge and archived by
 * lib/clips.ts. Accepting whole clips here would duplicate data the site
 * already owns and risk two rows for one story.
 *
 * `videoId` is the Facebook video id — in n8n it is
 * $('Create Facebook Container').first().json.video_id, on the site it is
 * Clip.id. The same value, which is what lets the two sides meet.
 */
export async function POST(request: Request): Promise<Response> {
  if (!authorized(request.headers.get(SECRET_HEADER))) {
    return fail(401, "unauthorized");
  }

  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
    return fail(413, `body too large (max ${MAX_BODY_BYTES} bytes)`);
  }

  let raw: string;
  try {
    raw = await request.text();
  } catch {
    return fail(400, "could not read request body");
  }
  // Content-Length can lie or be absent (chunked); check the bytes we actually got.
  if (Buffer.byteLength(raw, "utf8") > MAX_BODY_BYTES) {
    return fail(413, `body too large (max ${MAX_BODY_BYTES} bytes)`);
  }

  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return fail(400, "body is not valid JSON");
  }
  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
    return fail(400, "body must be a JSON object");
  }
  const p = payload as Record<string, unknown>;

  const videoId = str(p.videoId);
  if (!videoId) return fail(400, "videoId: required non-empty string");

  const input: ScriptInput = {
    videoId,
    scriptTh: str(p.scriptTh),
    articleTh: str(p.articleTh),
    rewrittenTitle: str(p.rewrittenTitle),
    sourceUrl: str(p.sourceUrl),
    sourcePublisher: str(p.sourcePublisher),
  };
  // A payload carrying nothing but an id would be a silent no-op that still
  // answers 200, which would hide a broken n8n expression for weeks.
  if (!input.scriptTh && !input.articleTh && !input.rewrittenTitle && !input.sourceUrl && !input.sourcePublisher) {
    return fail(400, "nothing to store: send at least one of scriptTh, articleTh, rewrittenTitle, sourceUrl, sourcePublisher");
  }

  // upsertScript never throws; false means no DATABASE_URL or a failed query.
  // Answer 5xx either way so n8n retries instead of dropping the rewrite.
  if (!(await upsertScript(input))) {
    return fail(503, "store unavailable — script was not persisted, retry");
  }

  // Revalidate the article page on-demand instead of relying on the hourly
  // ISR sweep. No slug yet means the clip hasn't been archived — nothing
  // cached to invalidate.
  const slug = await getStoredSlugById(videoId);
  if (slug) revalidatePath(`/news/${slug}`);

  return json({ ok: true, videoId }, 200);
}
