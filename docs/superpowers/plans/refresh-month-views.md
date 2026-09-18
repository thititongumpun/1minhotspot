# Refresh this month's Facebook view counts hourly

## Goal
The home page "Most viewed this month" rail ranks `clips.views` in D1, but a clip's
count is only written while it is inside the 50-item `/videos` feed (~1 day at the
current publish rate) and then freezes forever. Example: id 1622140695996655 stored
14,540, Facebook now reports 697,415. Fix: on every hourly `load()` refresh, re-poll
`views`/`likes`/`comments` for every Facebook clip published this Bangkok month via the
Graph batch-ids endpoint and bump the stored counts.

## Global Constraints
- Never throw out of the refresh path: a Graph or D1 failure logs and leaves the site
  serving as before (same never-throw discipline as `lib/store.ts run()` and
  `archive()` in `lib/clips.ts`).
- Counts only move upward: `max(existing, incoming)`, same as `upsertClip`.
  Missing/undefined incoming counts must not touch the column.
- Graph batch endpoint: `GET https://graph.facebook.com/{v}/?ids=<comma ids>&fields=views,likes.summary(true).limit(0),comments.summary(true).limit(0)&access_token=…`,
  at most 50 ids per call, `cache: "no-store"`. Response is an object keyed by id:
  `{ "<id>": { id, views, likes:{summary:{total_count}}, comments:{summary:{total_count}} }, … }`.
  If the whole call is rejected, retry once without the three engagement fields is
  pointless (nothing left to fetch) — just log and return what other chunks yielded.
- Only Facebook clips (`source = 'facebook'`), published `>= bangkokMonthStartIso(now)`.
- Tests are framework-free tsx self-checks (`pnpm exec tsx <file>`), no network,
  asserting with `node:assert/strict`, one `console.log("ok  …")` per group.
- Style: ponytail — smallest working diff, no new abstractions, reuse `graphGet`,
  `run()`, `bangkokMonthStartIso`. Comments explain *why* (existing file tone).
- Verify each task with `pnpm exec tsc --noEmit`, `pnpm exec eslint <files>`, and the
  self-check test(s) named in the task.

## Task 1 — provider: `fetchFacebookEngagement(ids)`

Files: `lib/providers/facebook.ts`, `lib/providers/facebook.test.ts`.

1. Export a pure helper `parseEngagement(json: Record<string, GraphVideo | undefined>): Engagement[]`
   where `export type Engagement = { id: string; views?: number; likes?: number; comments?: number }`.
   It maps each entry to `{ id: key, views: typeof v.views === "number" ? v.views : undefined,
   likes: v.likes?.summary?.total_count, comments: v.comments?.summary?.total_count }`,
   skipping entries that are not objects (Graph returns `false`/null for deleted ids).
2. Generalise `graphGet` so the fields list is a parameter: add `fields = FIELDS` and
   `fallbackFields: string | null = FIELDS_WITHOUT_VIEWS` params; when `fallbackFields`
   is null, do not retry. Existing callers unchanged in behaviour.
3. Export `async function fetchFacebookEngagement(ids: string[]): Promise<Engagement[]>`:
   returns `[]` when `FB_ACCESS_TOKEN` is missing or `ids` is empty; splits ids into
   chunks of 50; for each chunk calls `graphGet<Record<string, GraphVideo>>("", token,
   { cache: "no-store" }, "&ids=" + chunk.join(","), ENGAGEMENT_FIELDS, null)` where
   `ENGAGEMENT_FIELDS = "views,likes.summary(true).limit(0),comments.summary(true).limit(0)"`;
   chunks run with `Promise.all`; a failed chunk is caught, logged as
   `[facebook] engagement chunk: <message>` and contributes nothing. Never throws.
   Note the path is `""` so the URL is `https://graph.facebook.com/{v}/?fields=…&ids=…`.
4. Tests (append to `facebook.test.ts` `main()`):
   - `parseEngagement({ a: { id: "a", views: 5, likes: { summary: { total_count: 2 } } , comments: { summary: { total_count: 1 } } }, b: false as never })`
     deep-equals `[{ id: "a", views: 5, likes: 2, comments: 1 }]`.
   - `parseEngagement({ c: { id: "c" } })` deep-equals `[{ id: "c", views: undefined, likes: undefined, comments: undefined }]`.
   - Chunking: export `chunk<T>(arr: T[], size: number): T[][]` and assert
     `chunk([1,2,3,4,5], 2)` → `[[1,2],[3,4],[5]]` and `chunk([], 2)` → `[]`.
   - Log line: `ok  engagement: parses batch-ids responses, chunks by 50`.
5. Commit: `Provider: batch-fetch views/likes/comments for a list of video ids`.

## Task 2 — store + load: bump this month's counts hourly

Files: `lib/db.ts`, `lib/store.ts`, `lib/clips.ts`, `lib/store.test.ts` (new).

1. `lib/db.ts`: add `batch(statements: D1PreparedStatement[]): Promise<unknown[]>;` to the
   `D1` type (real D1 method; same "just the slice we use" comment applies).
2. `lib/store.ts`:
   - `export async function getMonthFacebookIds(now = new Date()): Promise<string[]>` —
     `run("getMonthFacebookIds", [], …)`: `select id from clips where source = 'facebook'
     and published_at >= ?` bound to `bangkokMonthStartIso(now)`; return `String(r.id)`.
   - `export async function bumpEngagement(rows: Engagement[]): Promise<boolean>` (import
     `Engagement` type from `./providers/facebook`) — `run("bumpEngagement", false, …)`:
     filter rows where at least one count is a finite number; if none, return true; build
     one prepared statement per row:
     `update clips set views = max(views, ?), likes = max(likes, ?), comments = max(comments, ?) where id = ?`
     binding `views ?? 0`, `likes ?? 0`, `comments ?? 0`, id (0 is a no-op under max —
     say so in a comment, mirroring the upsert comment at line ~178); send via
     `db.batch(stmts)` in slices of 100 statements (D1 batch is fine with that);
     return true. Also export the pure statement-shaping helper so it can be tested:
     `export function engagementBinds(rows: Engagement[]): [number, number, number, string][]`
     returning `[views ?? 0, likes ?? 0, comments ?? 0, id]` for rows with any finite count.
3. `lib/clips.ts`: add
   ```ts
   /**
    * Re-poll Facebook for this month's counts. The /videos feed only carries 50
    * clips (~1 day here), so a clip's views froze the day it left the feed — the
    * "Most viewed this month" rail was ranking day-one numbers. Best-effort: any
    * failure logs and the rail keeps its last-known counts.
    */
   async function refreshMonthEngagement(): Promise<void> {
     const ids = await getMonthFacebookIds();
     if (ids.length === 0) return;
     const rows = await fetchFacebookEngagement(ids);
     if (rows.length > 0) await bumpEngagement(rows);
   }
   ```
   and call `await refreshMonthEngagement();` in `loadUncached()` immediately after
   `await archive(blobbed);` (before `getStoredClips()`). Wrap the call in try/catch
   that logs `[clips] engagement refresh:` — belt and braces, as `load()` must never throw.
   Update the stale `-- ponytail: views freeze once a clip ages out…` comment in
   `lib/store.ts` upsert to say the monthly refresh (`bumpEngagement`) now keeps them
   moving, upward only.
4. Test `lib/store.test.ts` (new, no DB): import `engagementBinds` and `bangkokMonthStartIso`;
   assert `engagementBinds([{ id: "a", views: 3 }, { id: "b" }, { id: "c", likes: 1, comments: undefined }])`
   deep-equals `[[3, 0, 0, "a"], [0, 1, 0, "c"]]`; assert `engagementBinds([])` → `[]`.
   Log `ok  engagementBinds: drops countless rows, zero-fills for max()`.
   (Do not import `lib/clips.ts` in this test — it pulls next/cache and fails under tsx,
   see `lib/clips.test.ts` history.)
5. Commit: `Refresh this month's Facebook view counts on every hourly load`.

## Out of scope
`/api/hot` benefits automatically (same columns). No cron, no pagination of `/videos`.
