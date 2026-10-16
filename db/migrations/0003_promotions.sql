create table promotions (
  slug       text primary key,
  brand      text not null,
  title      text not null,
  summary    text not null,                 -- banner line
  body       text not null,                 -- plain text, blank-line paragraphs
  images     text not null default '[]',    -- JSON [{url,w,h,alt}], [0] = banner image
  links      text not null default '[]',    -- JSON [{label,url}]
  starts_at  text not null,                 -- UTC ISO, same convention as clips
  ends_at    text not null,
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
create index promotions_ends_at on promotions(ends_at);
