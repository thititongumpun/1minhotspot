/**
 * Publish one brand promotion from a folder of images plus a promo.json.
 *   pnpm promo:add promos/<slug>/            # dry run: keys, sizes and the upsert SQL
 *   pnpm promo:add promos/<slug>/ --apply    # R2 upload + D1 upsert + revalidate
 *
 * promo.json: {brand, title, summary, body, links: [{label, url}], starts_at, ends_at, alts?}
 * Images: *.jpg|*.png|*.webp in the folder, sorted by name → 01…nn. Each is
 * resized to a 1280 and a 640 WebP under promo/<slug>/. The 1280 URL is what
 * `promotions.images` stores; promoSmallUrl() derives the 640 sibling.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import sharp from "sharp";
import { hasR2Credentials, publicUrl, putObject } from "../lib/r2";
import type { PromoImage, PromoLink } from "../lib/types";
import { d1, lit } from "./_d1";
import { loadEnvLocal } from "./_env";

loadEnvLocal();

const dir = process.argv[2];
const apply = process.argv.includes("--apply");
if (!dir || dir.startsWith("--")) {
  console.error("usage: pnpm promo:add promos/<slug>/ [--apply]");
  process.exit(1);
}

const slug = basename(resolve(dir));
const images = readdirSync(dir)
  .filter((f) => /\.(jpe?g|png|webp)$/i.test(f) && statSync(join(dir, f)).isFile())
  .sort();
if (images.length === 0) {
  console.error(`error: no images in ${dir} (expected *.jpg|*.png|*.webp)`);
  process.exit(1);
}

type PromoJson = {
  brand: string;
  title: string;
  summary: string;
  body: string;
  links: PromoLink[];
  starts_at: string;
  ends_at: string;
  alts?: string[];
};
const json = JSON.parse(readFileSync(join(dir, "promo.json"), "utf8")) as PromoJson;

const errors: string[] = [];
if (!/^[a-z0-9-]+$/.test(slug)) errors.push(`slug "${slug}" must match /^[a-z0-9-]+$/`);
for (const k of ["brand", "title", "summary", "body", "starts_at", "ends_at"] as const) {
  if (typeof json[k] !== "string" || !json[k].trim()) errors.push(`${k} must be a non-empty string`);
}
const startsAt = Date.parse(json.starts_at);
const endsAt = Date.parse(json.ends_at);
if (Number.isNaN(startsAt)) errors.push(`starts_at "${json.starts_at}" does not parse`);
if (Number.isNaN(endsAt)) errors.push(`ends_at "${json.ends_at}" does not parse`);
if (!Number.isNaN(startsAt) && !Number.isNaN(endsAt) && endsAt <= startsAt) errors.push("ends_at must be after starts_at");
if (!Array.isArray(json.links)) errors.push("links must be an array");
else
  json.links.forEach((l, i) => {
    if (!l?.label?.trim()) errors.push(`links[${i}].label must be non-empty`);
    if (!/^https:\/\//.test(l?.url ?? "")) errors.push(`links[${i}].url must start with https://`);
  });
if (json.alts !== undefined && (!Array.isArray(json.alts) || json.alts.length !== images.length)) {
  errors.push(`alts must have one entry per image (${images.length})`);
}
if (errors.length) {
  for (const e of errors) console.error(`error: ${e}`);
  process.exit(1);
}

// Dry runs have no .env.local; stand in for the host so the SQL still reads as the real thing.
const host = process.env.R2_PUBLIC_HOST ?? "<R2_PUBLIC_HOST>";
const urlFor = (key: string) => (process.env.R2_PUBLIC_HOST ? publicUrl(key) : `https://${host}/${key}`);

async function upload(key: string, body: Buffer): Promise<void> {
  const head = await fetch(publicUrl(key), { method: "HEAD" });
  if (head.ok) {
    console.log(`exists ${key}`);
    return;
  }
  await putObject(key, body, "image/webp");
  console.log(`put ${key}`);
}

async function main() {
  if (apply && !hasR2Credentials()) {
    console.error("--apply needs R2_ACCOUNT_ID/R2_ACCESS_KEY_ID/R2_SECRET_ACCESS_KEY/R2_BUCKET/R2_PUBLIC_HOST in .env.local.");
    process.exit(1);
  }

  const stored: PromoImage[] = [];
  // ponytail: sequential, 18 images takes seconds; pool it if a promo ever ships hundreds.
  for (const [i, file] of images.entries()) {
    const nn = String(i + 1).padStart(2, "0");
    const src = sharp(join(dir, file)).rotate();
    for (const width of [1280, 640]) {
      const key = `promo/${slug}/${nn}-${width}.webp`;
      const { data, info } = await src
        .clone()
        .resize({ width, withoutEnlargement: true })
        .webp({ quality: 80 })
        .toBuffer({ resolveWithObject: true });
      console.log(`${key} ${info.width}x${info.height}`);
      if (width === 1280) {
        stored.push({ url: urlFor(key), w: info.width, h: info.height, alt: json.alts?.[i] ?? `${json.brand} ${nn}` });
      }
      if (apply) await upload(key, data);
    }
  }

  const row = {
    slug,
    brand: json.brand,
    title: json.title,
    summary: json.summary,
    body: json.body,
    images: JSON.stringify(stored),
    links: JSON.stringify(json.links),
    starts_at: new Date(startsAt).toISOString(),
    ends_at: new Date(endsAt).toISOString(),
  };
  const cols = Object.keys(row) as (keyof typeof row)[];
  const sql =
    `insert into promotions (${cols.join(", ")}) values (${cols.map((c) => lit(row[c])).join(", ")})\n` +
    `on conflict(slug) do update set ${cols.filter((c) => c !== "slug").map((c) => `${c} = excluded.${c}`).join(", ")}`;
  console.log(sql);

  if (!apply) return;

  d1(sql);
  console.log(`upserted promotions.${slug}`);

  const { NEXT_PUBLIC_SITE_URL, INGEST_SECRET } = process.env;
  if (!NEXT_PUBLIC_SITE_URL || !INGEST_SECRET) {
    console.log("skip revalidate (NEXT_PUBLIC_SITE_URL or INGEST_SECRET unset)");
  } else {
    const res = await fetch(`${NEXT_PUBLIC_SITE_URL}/api/promo-revalidate`, {
      method: "POST",
      headers: { "x-ingest-secret": INGEST_SECRET },
    });
    console.log(`revalidate ${res.status} ${await res.text().catch(() => "")}`);
  }
  console.log(`${NEXT_PUBLIC_SITE_URL ?? "https://1minhotspot.com"}/promo/${slug}`);
}

main().catch((err) => {
  console.error(`error: ${(err as Error).message}`);
  process.exit(1);
});
