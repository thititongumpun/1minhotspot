-- 1 Minute Hotspot — durable clip store (Cloudflare D1 / SQLite).
--
-- Why this exists: the Facebook /videos read path returns at most 50 items and
-- lib/providers/facebook.ts does not paginate. The Page publishes ~50 reels per
-- 16 hours, so the live feed is a ~16h sliding window: every article URL the
-- site emits 404s within a day and the sitemap shrinks in lockstep. This table
-- accumulates clips forever and is unioned with the live feed at read time.
--
-- Translated from db/schema.sql (Postgres). Column names and order are
-- identical so lib/store.ts toClip() needs no changes. Dialect differences:
--   timestamptz -> text holding UTC ISO 8601 ("2026-09-13T01:46:00.000Z"),
--                  same format on every row so order by / max() / >= stay
--                  correct lexicographically.
--   text[]      -> text holding a JSON array (JSON.stringify on write).
--   now()       -> strftime('%Y-%m-%dT%H:%M:%fZ','now')
-- Future column adds are a new migration (drop view + create view for
-- clips_full; SQLite has no create or replace view).

create table clips (
  -- slug is the public URL key (/news/<slug>) and therefore the identity of the
  -- row: ingest is idempotent on it. Thai codepoints are kept in slugs.
  slug              text primary key,

  -- ---- the existing Clip shape (lib/types.ts) ----
  id                text    not null,          -- provider video id
  source            text    not null check (source in ('facebook', 'youtube', 'sample')),
  title             text    not null,
  summary           text    not null default '',
  body              text    not null default '',
  category          text    not null check (category in ('society', 'entertainment', 'politics', 'viral', 'economy')),
  -- UTC ISO 8601, never naive local time: the site renders Buddhist-era dates in
  -- Asia/Bangkok and derives the Google News 48h window from published_at.
  published_at      text    not null,
  updated_at        text    not null,
  duration_sec      integer not null check (duration_sec >= 0),
  thumbnail_url     text    not null,
  thumbnail_width   integer not null,
  thumbnail_height  integer not null,
  embed_url         text    not null,
  permalink         text    not null,
  tags              text    not null default '[]',
  views             integer not null default 0,
  likes             integer not null default 0,
  comments          integer not null default 0
);

-- Hot read path 1: newest-first listing (home, /videos, sitemap).
-- Also the index the Google News sitemap's 48h window rides:
--   where published_at > ? order by published_at desc
create index clips_published_at_idx on clips (published_at desc);

-- Hot read path 2: /category/[category], newest-first within the category.
create index clips_category_published_at_idx on clips (category, published_at desc);

-- ---------------------------------------------------------------------------
-- n8n-sourced Thai rewrites, keyed by the FACEBOOK video id.
--
-- Separate table on purpose. n8n POSTs the script the moment it publishes the
-- reel, which is up to an hour BEFORE the site's hourly revalidate first sees
-- that reel on the /videos edge. A row in `clips` may therefore not exist yet,
-- and a stub row is impossible — `clips` is full of NOT NULL columns the
-- publish step has no values for. Keying on video_id instead of slug also means
-- a re-slugged clip keeps its script.
--
-- Joined onto `clips` at read time (lib/store.ts). A script with no matching
-- clip is harmless: it simply waits for the clip to show up.
create table clip_scripts (
  -- Facebook video id: $('Create Facebook Container').first().json.video_id in
  -- the n8n workflows, and Clip.id on the site. Same value, both sides.
  video_id          text primary key,

  -- The 70-90 word Thai narration. 100% original prose written by Gemini under
  -- a prompt that forbids quoting the source, so this is our own editorial text
  -- and becomes the article body. Never a copy of the publisher's article.
  script_th         text,
  -- Rewritten headline, display only. The slug stays derived from the original
  -- Facebook caption so a rewrite never moves a live URL.
  rewritten_title   text,
  -- Provenance of the story the reel summarises.
  source_url        text,
  source_publisher  text,

  updated_at        text not null default (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  -- The 250-400 word written article, a second Gemini pass over the same source.
  -- The narration above is what the reel speaks (and the VideoObject transcript);
  -- this is the page body when present.
  article_th        text
);

-- Read-side join. Every site query goes through this view, so the script lookup
-- can never be forgotten at a call site. A clip with no rewrite yet simply has
-- NULLs here, which lib/store.ts maps to "fall back to the caption body".
--
-- Columns are listed explicitly rather than `c.*`: `s.*` would collide on
-- updated_at. Adding a column to `clips` means adding it here too.
create view clips_full as
select
  c.slug,
  c.id,
  c.source,
  c.title,
  c.summary,
  c.body,
  c.category,
  c.published_at,
  c.updated_at,
  c.duration_sec,
  c.thumbnail_url,
  c.thumbnail_width,
  c.thumbnail_height,
  c.embed_url,
  c.permalink,
  c.tags,
  s.script_th,
  s.rewritten_title,
  s.source_url,
  s.source_publisher,
  c.views,
  s.article_th,
  -- The rewrite's own timestamp, so lib/store.ts can take max(clip, script) as
  -- the real dateModified: an n8n article_th landing IS a body change, but it
  -- never touches clips.updated_at (archive() writes the raw Facebook caption).
  -- Aliased because c.updated_at already owns the bare name.
  s.updated_at as script_updated_at,
  c.likes,
  c.comments
from clips c
left join clip_scripts s on s.video_id = c.id;
