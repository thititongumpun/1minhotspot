/**
 * Backfill `clip_scripts.article_th` — the 250-400 word written article that
 * lib/store.ts prefers as the page body — for clips that only ever got the
 * 70-90 word narration (`script_th`).
 *
 *   pnpm exec tsx scripts/backfill-articles.ts submit [--limit N] [--dry-run]
 *   pnpm exec tsx scripts/backfill-articles.ts status
 *   pnpm exec tsx scripts/backfill-articles.ts apply
 *
 * Why this exists: measured against the live site in Sep 2026, the median
 * article body was 383 Thai characters and 64% of pages were under 500 — a
 * reel plus two sentences. That is Google's "insufficient content" example
 * almost verbatim, and the site's AdSense review is stuck on it. The 250-400
 * word path already existed end to end (n8n -> /api/ingest -> upsertScript ->
 * clips_full -> page body); it had simply never been run over the archive.
 *
 * Why three subcommands and not one loop: the Gemini Batch API is asynchronous
 * (24h target turnaround, usually far less) and costs half of standard rates.
 * ~710 clips comes to roughly $0.12. There is no deadline here, so paying
 * double to watch a progress bar would be silly.
 *
 * Why the JSONL file path and not inline requests: inline responses come back
 * as a positional array, and a batch with partial failures returns error
 * objects in place — one shifted index would staple the wrong article onto the
 * wrong news story, silently and permanently. Each request carries an explicit
 * `key` = the Facebook video id instead, and apply() refuses any key it cannot
 * match to a clip that is still missing article_th.
 *
 * Writes go through wrangler, not lib/store.ts: upsertScript() resolves its D1
 * handle via getCloudflareContext(), which returns null under plain tsx. The
 * upsert SQL below is the same statement, kept deliberately identical.
 */
import { strict as assert } from "node:assert";
import { readFileSync, writeFileSync, existsSync, unlinkSync } from "node:fs";
import { d1, lit } from "./_d1";
import { loadEnvLocal } from "./_env";
import { PLACEHOLDER } from "../lib/normalize";

const MODEL = "gemini-2.5-flash-lite";
const REQUESTS_FILE = ".backfill-requests.jsonl";
const RESULTS_FILE = ".backfill-results.jsonl";
const JOB_FILE = ".backfill-job.json";

/**
 * Floor for an accepted generation, in Thai characters. Roughly 180 words.
 *
 * A short article_th is worse than none: the column is preferred over
 * script_th unconditionally, so writing a 300-character "article" would
 * permanently replace a 383-character narration with something shorter and
 * there is no second pass to notice. Rejecting instead leaves the row eligible
 * for the next submit.
 */
const MIN_ARTICLE_CHARS = 800;

/**
 * How much of the source article to put in the prompt.
 *
 * This text is prompt input only — it is never stored and never rendered. The
 * model is told to write from it, not to reproduce it, and the output replaces
 * a body the site would otherwise not have. The site's own attributed-excerpt
 * block (app/news/[slug]/page.tsx) remains the only place a publisher's words
 * are shown verbatim.
 */
const SOURCE_CHARS = 3000;

/** Fetches that hang must not hold up a 700-row submit. */
const FETCH_TIMEOUT_MS = 15_000;
const FETCH_CONCURRENCY = 6;

type Row = {
  slug: string;
  id: string;
  title: string;
  rewritten_title: string | null;
  body: string | null;
  script_th: string | null;
  source_url: string | null;
  source_publisher: string | null;
};

/** A Row plus whatever could be read from its source_url. */
type Sourced = Row & { sourceText?: string };

/** Visible text from a source article page. Best-effort: any failure yields "". */
export function extractText(html: string): string {
  const withoutNoise = html
    .replace(/<(script|style|noscript|nav|header|footer|aside|form)\b[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ");
  const main =
    /<article\b[^>]*>([\s\S]*?)<\/article>/i.exec(withoutNoise)?.[1] ??
    /<main\b[^>]*>([\s\S]*?)<\/main>/i.exec(withoutNoise)?.[1] ??
    withoutNoise;
  return main
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, SOURCE_CHARS);
}

async function fetchSource(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { "user-agent": "Mozilla/5.0 (compatible; 1minhotspot-backfill/1.0)" },
    });
    if (!res.ok) return "";
    return extractText(await res.text());
  } catch {
    return ""; // a dead link is not a reason to abandon the clip
  }
}

/** Fetch every source_url with a small pool; failures come back as "". */
async function withSources(rows: Row[]): Promise<Sourced[]> {
  const out: Sourced[] = rows.map((r) => ({ ...r }));
  let next = 0;
  let done = 0;
  await Promise.all(
    Array.from({ length: Math.min(FETCH_CONCURRENCY, rows.length) }, async () => {
      for (let i = next++; i < rows.length; i = next++) {
        const url = rows[i].source_url;
        if (url) out[i].sourceText = await fetchSource(url);
        if (++done % 25 === 0) console.log(`  fetched ${done}/${rows.length} sources`);
      }
    }),
  );
  return out;
}

/**
 * Strip the honest-stand-in sentinel before it reaches the model.
 *
 * lib/normalize.ts sets PLACEHOLDER ("รายละเอียดเพิ่มเติมอยู่ระหว่างตรวจสอบ") on
 * captions with no real body, precisely so the site never pretends to have
 * content it lacks. The first batch run proved a model handed that string will
 * dutifully expand it into a paragraph — laundering "we don't know" into
 * article prose, which is the exact opposite of what the sentinel is for.
 */
const stripPlaceholder = (text: string | null): string =>
  (text ?? "").split(PLACEHOLDER).join(" ").replace(/\s+/g, " ").trim();

/**
 * The second Gemini pass described in db/migrations/0001_init.sql.
 *
 * Rewritten after a 5-clip trial run whose output cleared the length gate on
 * padding: four paragraphs of generic market commentary around one fact, a
 * promised list of "8 groups" that was never listed, and unbidden investment
 * advice. Length is not the goal — a real article is. The rules below are each
 * a failure observed in that run, and rule 7 is the important one: writing
 * short is allowed, padding is not. A generation too short to clear
 * MIN_ARTICLE_CHARS is rejected and the clip keeps its narration, which is a
 * better outcome than a padded page an AdSense reviewer reads as
 * auto-generated.
 */
export function buildPrompt(row: Sourced): string {
  const title = row.rewritten_title || row.title;
  const caption = stripPlaceholder(row.body);
  const parts = [
    `หัวข้อข่าว: ${title}`,
    row.script_th ? `บทบรรยายเสียงของคลิป: ${stripPlaceholder(row.script_th)}` : "",
    caption ? `คำบรรยายต้นฉบับของคลิป: ${caption}` : "",
    row.sourceText ? `เนื้อหาจากข่าวต้นทาง (ใช้เป็นข้อมูล ห้ามคัดลอก): ${row.sourceText}` : "",
    row.source_publisher ? `สำนักข่าวต้นทาง: ${row.source_publisher}` : "",
  ].filter(Boolean);

  return `คุณคือกองบรรณาธิการข่าวไทย เขียน "เนื้อข่าว" จากข้อมูลด้านล่าง

ข้อกำหนด
1. ภาษาไทย แบ่ง 3-5 ย่อหน้า คั่นย่อหน้าด้วยบรรทัดว่าง
2. ใช้สำนวนของคุณเองทั้งหมด ห้ามคัดลอกหรือเรียบเรียงประโยคจากข้อมูลต้นทาง
3. ห้ามเพิ่มข้อเท็จจริงที่ไม่มีในข้อมูลด้านล่าง โดยเฉพาะ ชื่อบุคคล ตัวเลข ยอดเงิน
   วันที่ สถานที่ และคำพูดในเครื่องหมายคำพูด
4. ทุกย่อหน้าต้องมีข้อเท็จจริงจากข้อมูลต้นทาง ห้ามเขียนย่อหน้าที่เป็นคำอธิบาย
   ทั่วไป ภูมิหลังกว้าง ๆ หรือการคาดเดาผลกระทบ เพื่อเพิ่มความยาว
5. ถ้าอ้างถึงจำนวนรายการ เช่น "8 กลุ่ม" หรือ "5 ข้อ" ต้องระบุรายการนั้นให้ครบจริง
   ถ้าไม่มีข้อมูลครบ ห้ามอ้างตัวเลขนั้น
6. ห้ามให้คำแนะนำการลงทุน การซื้อขาย หรือการรักษาโรค ห้ามชี้นำให้ผู้อ่านตัดสินใจ
7. ความยาวที่ต้องการคือ 250-400 คำ แต่ถ้าข้อมูลไม่พอ ให้เขียนสั้นกว่านั้น
   การเขียนสั้นแต่มีเนื้อหาจริง ดีกว่าการเขียนยาวด้วยเนื้อหาที่ไม่มีข้อมูลรองรับ
8. ห้ามเขียนว่าข้อมูลอยู่ระหว่างการตรวจสอบ หรือรอการยืนยัน ถ้าไม่รู้ ให้ไม่ต้องเขียนถึง
9. ห้ามใส่พาดหัว ห้ามใช้ Markdown ห้ามใส่แฮชแท็ก ห้ามใส่ลิงก์
   ห้ามลงท้ายด้วยการชวนกดไลก์ กดแชร์ แสดงความคิดเห็น หรือติดตามเพจ
10. ตอบกลับเป็นเนื้อข่าวอย่างเดียว ห้ามมีคำนำหรือคำอธิบายอื่น

ข้อมูล
${parts.join("\n")}`;
}

/** Model output -> the string that becomes the page body, or null to reject. */
export function cleanArticle(text: string): string | null {
  const cleaned = text
    .replace(/```[a-z]*\n?/gi, "")
    .replace(/^#{1,6}\s*/gm, "")
    .replace(/\*\*/g, "")
    .split("\n")
    .map((line) => line.trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  // Belt and braces: rule 8 tells the model not to say this, and the sentinel
  // is stripped from the input, but a rejected generation costs nothing and a
  // laundered "still being verified" paragraph on a live article page costs
  // exactly the credibility the placeholder exists to protect.
  if (/อยู่ระหว่าง(การ)?ตรวจสอบ|รอการยืนยัน/.test(cleaned)) return null;
  // Observed in the trial run: given a story it had no figures for, the model
  // wrote "ราคารับซื้ออยู่ที่ [ตัวเลข] บาท" — a fill-in-the-blank it expected
  // someone else to complete. It cleared the length gate. Any bracketed slot
  // is a generation admitting it lacks a fact, so the whole article goes.
  if (/[\[\]{}]|X{3,}|_{3,}/.test(cleaned)) return null;
  return cleaned.length >= MIN_ARTICLE_CHARS ? cleaned : null;
}

const missingSql = (limit: number | null) =>
  `select slug, id, title, rewritten_title, body, script_th, source_url, source_publisher
     from clips_full
    where coalesce(article_th, '') = '' and source <> 'sample'
    order by published_at desc${limit ? ` limit ${limit}` : ""}`;

async function client() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set (put it in .env.local, or `vercel env pull`)");
  const { GoogleGenAI } = await import("@google/genai");
  return new GoogleGenAI({ apiKey });
}

const readJob = (): { name: string; count: number; submittedAt: string } => {
  if (!existsSync(JOB_FILE)) throw new Error(`no ${JOB_FILE} — run \`submit\` first`);
  return JSON.parse(readFileSync(JOB_FILE, "utf8"));
};

async function submit(limit: number | null, dryRun: boolean, allowNoSource: boolean) {
  const found = d1<Row>(missingSql(limit));
  if (found.length === 0) {
    console.log("nothing to do: every clip already has article_th");
    return;
  }

  const withUrl = found.filter((r) => r.source_url).length;
  console.log(`${found.length} clips missing article_th (${withUrl} have a source_url)\nfetching sources...`);
  const sourced = await withSources(found);
  const fetched = sourced.filter((r) => r.sourceText).length;
  console.log(`  ${fetched}/${found.length} sources readable`);

  // Without a source article there is nothing to write FROM: the trial run's
  // one source-less clip produced generic market commentary with "[ตัวเลข]"
  // where the prices belonged. Skipping leaves that clip on its 90-word
  // narration, which is thin but true — the whole point of this exercise is
  // more real content, not more words. --allow-nosource overrides.
  const rows = allowNoSource ? sourced : sourced.filter((r) => r.sourceText);
  const skipped = sourced.length - rows.length;
  if (skipped > 0) console.log(`  skipping ${skipped} with no readable source (--allow-nosource to include)`);
  if (rows.length === 0) {
    console.log("nothing to submit");
    return;
  }

  const lines = rows.map((row) =>
    JSON.stringify({
      key: row.id,
      request: {
        contents: [{ role: "user", parts: [{ text: buildPrompt(row) }] }],
        // Thinking tokens bill as output. A 300-word news rewrite does not
        // need them, and they would multiply the cost of the run several-fold.
        generationConfig: { temperature: 0.7, thinkingConfig: { thinkingBudget: 0 } },
      },
    }),
  );
  writeFileSync(REQUESTS_FILE, lines.join("\n") + "\n");
  console.log(`wrote ${rows.length} requests -> ${REQUESTS_FILE}`);

  if (dryRun) {
    console.log("\n--- first prompt ---\n");
    console.log(buildPrompt(rows[0]));
    console.log("\n(dry run: nothing submitted)");
    return;
  }

  const ai = await client();
  const uploaded = await ai.files.upload({
    file: REQUESTS_FILE,
    config: { displayName: "backfill-articles", mimeType: "application/jsonl" },
  });
  const job = await ai.batches.create({
    model: MODEL,
    src: uploaded.name!,
    config: { displayName: `backfill-articles-${new Date().toISOString().slice(0, 10)}` },
  });
  writeFileSync(
    JOB_FILE,
    JSON.stringify({ name: job.name, count: rows.length, submittedAt: new Date().toISOString() }, null, 2),
  );
  console.log(`submitted ${job.name} (${rows.length} requests)\nnext: \`status\`, then \`apply\` once it succeeds`);
}

async function status() {
  const { name, count, submittedAt } = readJob();
  const job = await (await client()).batches.get({ name });
  console.log(`${name}\n  state:     ${job.state}\n  requests:  ${count}\n  submitted: ${submittedAt}`);
}

async function apply() {
  const { name } = readJob();
  const ai = await client();
  const job = await ai.batches.get({ name });
  if (String(job.state) !== "JOB_STATE_SUCCEEDED") {
    throw new Error(`job is ${job.state}, not JOB_STATE_SUCCEEDED — nothing to apply`);
  }

  const outFile = job.dest?.fileName;
  if (!outFile) throw new Error("job succeeded but carries no output file");
  if (existsSync(RESULTS_FILE)) unlinkSync(RESULTS_FILE);
  await ai.files.download({ file: outFile, downloadPath: RESULTS_FILE });

  // Only rows STILL missing article_th are eligible. Re-running apply after a
  // partial run therefore cannot overwrite what the first run wrote, and a key
  // that does not appear here is a mismatch worth failing on rather than
  // guessing at. Ids only: apply needs membership, not the rows themselves.
  const eligible = new Set(
    d1<{ id: string }>(
      `select id from clips_full where coalesce(article_th, '') = '' and source <> 'sample'`,
    ).map((r) => r.id),
  );

  const writes: string[] = [];
  let short = 0;
  let failed = 0;
  let unknown = 0;

  for (const line of readFileSync(RESULTS_FILE, "utf8").split("\n")) {
    if (!line.trim()) continue;
    const parsed = JSON.parse(line) as {
      key?: string;
      response?: { candidates?: { content?: { parts?: { text?: string }[] } }[] };
      error?: unknown;
    };
    const key = parsed.key;
    if (!key) throw new Error(`result line has no key — refusing to guess which clip it belongs to: ${line.slice(0, 120)}`);
    if (!eligible.has(key)) {
      unknown++;
      continue;
    }
    if (parsed.error || !parsed.response) {
      failed++;
      continue;
    }
    const text = parsed.response.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
    const article = cleanArticle(text);
    if (!article) {
      short++;
      continue;
    }
    writes.push(
      `insert into clip_scripts (video_id, article_th) values (${lit(key)}, ${lit(article)})
       on conflict (video_id) do update set
         article_th = coalesce(excluded.article_th, clip_scripts.article_th),
         updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now');`,
    );
  }

  // Chunked: one wrangler invocation is ~1s, so 710 single-row calls would be
  // a 12-minute wall clock for what is a few seconds of actual work.
  const CHUNK = 25;
  for (let i = 0; i < writes.length; i += CHUNK) {
    d1(writes.slice(i, i + CHUNK).join("\n"));
    console.log(`  wrote ${Math.min(i + CHUNK, writes.length)}/${writes.length}`);
  }

  console.log(
    `\napplied ${writes.length} articles` +
      `\n  rejected (too short, placeholder text, or a [blank] slot): ${short}` +
      `\n  model errors: ${failed}` +
      `\n  keys no longer eligible (already filled): ${unknown}` +
      (short + failed > 0 ? `\n\nre-run \`submit\` to retry the ${short + failed} that did not land.` : ""),
  );
}

async function main() {
  loadEnvLocal();
  const [cmd, ...rest] = process.argv.slice(2);
  const limitArg = rest.indexOf("--limit");
  const limit = limitArg >= 0 ? Number(rest[limitArg + 1]) : null;
  if (limit !== null && (!Number.isInteger(limit) || limit <= 0)) throw new Error("--limit needs a positive integer");

  if (cmd === "submit") return submit(limit, rest.includes("--dry-run"), rest.includes("--allow-nosource"));
  if (cmd === "status") return status();
  if (cmd === "apply") return apply();
  console.error("usage: backfill-articles.ts submit [--limit N] [--dry-run] [--allow-nosource] | status | apply");
  process.exitCode = 1;
}

// Self-check: pnpm exec tsx scripts/backfill-articles.ts --test
if (process.argv.includes("--test")) {
  const row: Row = {
    slug: "s", id: "v1", title: "หัวเดิม", rewritten_title: "หัวใหม่",
    body: "คำบรรยาย", script_th: "บทเสียง", source_url: null, source_publisher: "Sanook",
  };
  assert.ok(buildPrompt(row).includes("หัวใหม่"), "the rewritten headline wins, as it does on the page");
  assert.ok(buildPrompt({ ...row, sourceText: "เนื้อข่าวจริง" }).includes("เนื้อข่าวจริง"), "fetched source reaches the prompt");
  assert.ok(!buildPrompt(row).includes("เนื้อหาจากข่าวต้นทาง"), "no fetched source -> no empty source section");
  assert.ok(
    !buildPrompt({ ...row, body: `คำบรรยาย ${PLACEHOLDER}`, script_th: PLACEHOLDER }).includes(PLACEHOLDER),
    "the placeholder sentinel must never reach the model",
  );

  assert.equal(extractText("<script>bad()</script><p>ดี</p>"), "ดี", "scripts stripped");
  assert.equal(extractText("<article><p>ในบทความ</p></article><p>นอก</p>"), "ในบทความ", "<article> wins over page chrome");
  assert.equal(extractText("<p>a&amp;b&nbsp;c</p>"), "a&b c", "entities decoded");
  assert.equal(extractText("<p>" + "ก".repeat(SOURCE_CHARS + 500) + "</p>").length, SOURCE_CHARS, "capped");

  assert.ok(!buildPrompt(row).includes("หัวเดิม"));
  assert.ok(buildPrompt({ ...row, rewritten_title: null }).includes("หัวเดิม"), "falls back to the original");
  assert.ok(!buildPrompt({ ...row, script_th: null }).includes("บทบรรยายเสียง"), "absent fields are omitted, not empty-labelled");

  assert.equal(cleanArticle("สั้นเกินไป"), null, "a short generation must be rejected, never stored");
  assert.equal(
    cleanArticle("ก".repeat(MIN_ARTICLE_CHARS) + " รายละเอียดอยู่ระหว่างตรวจสอบ"),
    null,
    "long enough, but it laundered the placeholder — reject",
  );
  const pad = "ก".repeat(MIN_ARTICLE_CHARS);
  assert.equal(cleanArticle(`${pad} ราคาอยู่ที่ [ตัวเลข] บาท`), null, "a bracketed fill-in-the-blank is not an article");
  assert.equal(cleanArticle(`${pad} ชื่อ {name}`), null);
  assert.equal(cleanArticle(`${pad} XXX`), null);
  assert.equal(cleanArticle(pad), pad, "clean prose of the same length still passes");
  const long = "ก".repeat(MIN_ARTICLE_CHARS);
  assert.equal(
    cleanArticle(`## หัวข้อ\n\n**${long}**`),
    `หัวข้อ\n\n${long}`,
    "markdown markers go, the words they wrapped stay",
  );
  assert.equal(cleanArticle(`${long}\n\n\n\nท้าย`), `${long}\n\nท้าย`, "blank-line runs collapse to one paragraph break");
  assert.equal(cleanArticle(`  ${long}  `), long);

  assert.ok(missingSql(null).includes("coalesce(article_th, '') = ''"), "only ever selects rows with no article");
  assert.ok(missingSql(5).endsWith("limit 5"));
  assert.ok(!missingSql(null).includes("limit"), "no limit means no limit");
  console.log("ok scripts/backfill-articles.ts");
} else {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  });
}
