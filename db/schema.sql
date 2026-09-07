-- 1 Minute Hotspot — durable clip store (Neon Postgres).
--
-- Why this exists: the Facebook /videos read path returns at most 50 items and
-- lib/providers/facebook.ts does not paginate. The Page publishes ~50 reels per
-- 16 hours, so the live feed is a ~16h sliding window: every article URL the
-- site emits 404s within a day and the sitemap shrinks in lockstep. This table
-- accumulates clips forever and is unioned with the live feed at read time.
--
-- Apply with:  psql "$DATABASE_URL" -f db/schema.sql

create table if not exists clips (
  -- slug is the public URL key (/news/<slug>) and therefore the identity of the
  -- row: ingest is idempotent on it. Thai codepoints are kept in slugs, so this
  -- is text, never varchar(n).
  slug              text primary key,

  -- ---- the existing Clip shape (lib/types.ts) ----
  id                text        not null,          -- provider video id
  source            text        not null check (source in ('facebook', 'youtube', 'sample')),
  title             text        not null,
  summary           text        not null default '',
  body              text        not null default '',
  category          text        not null check (category in ('society', 'entertainment', 'politics', 'viral', 'economy')),
  -- timestamptz, never naive local time: the site renders Buddhist-era dates in
  -- Asia/Bangkok and derives the Google News 48h window from published_at.
  published_at      timestamptz not null,
  updated_at        timestamptz not null,
  duration_sec      integer     not null check (duration_sec >= 0),
  thumbnail_url     text        not null,
  thumbnail_width   integer     not null,
  thumbnail_height  integer     not null,
  embed_url         text        not null,
  permalink         text        not null,
  tags              text[]      not null default '{}'
);

-- Additive, safe to re-run: upgrades an existing database when the create
-- table above no-ops because the table already exists.
alter table clips add column if not exists views integer not null default 0;

-- Hot read path 1: newest-first listing (home, /videos, sitemap).
-- Also the index the Google News sitemap's 48h window rides:
--   where published_at > now() - interval '48 hours' order by published_at desc
create index if not exists clips_published_at_idx on clips (published_at desc);

-- Hot read path 2: /category/[category], newest-first within the category.
create index if not exists clips_category_published_at_idx on clips (category, published_at desc);

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
create table if not exists clip_scripts (
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

  updated_at        timestamptz not null default now()
);
-- The 250-400 word written article, a second Gemini pass over the same source.
-- The narration above is what the reel speaks (and the VideoObject transcript);
-- this is the page body when present. Added after launch, hence the ALTER.
alter table clip_scripts add column if not exists article_th text;

-- Read-side join. Every site query goes through this view, so the script lookup
-- can never be forgotten at a call site. A clip with no rewrite yet simply has
-- NULLs here, which lib/store.ts maps to "fall back to the caption body".
--
-- Columns are listed explicitly rather than `c.*`. Two reasons: `s.*` would
-- collide on updated_at, and an earlier revision of this schema put script_th /
-- rewritten_title / source_url / source_publisher on `clips` itself. Naming the
-- columns means the view works whether or not those dead columns still exist,
-- so no destructive migration is needed to adopt it. They are unused and may be
-- dropped at leisure:
--   alter table clips drop column if exists script_th, ... ;
--
-- Adding a column to `clips` means adding it here too.
create or replace view clips_full as
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
  -- Appended at the end, not alongside the other `clips` columns above:
  -- CREATE OR REPLACE VIEW can only add new output columns at the end of the
  -- list — inserting one in the middle errors "cannot change name of view
  -- column" on a database that already has this view.
  c.views,
  s.article_th
from clips c
left join clip_scripts s on s.video_id = c.id;
