-- clips.id (the Facebook video id) had no index: bumpEngagement's hourly
-- `update … where id = ?` per this-month clip was a full scan each, and the
-- clips_full view joins clip_scripts.video_id on it. Unique: one row per reel
-- is what upsertClip's slug key already assumes.
create unique index if not exists clips_id_idx on clips (id);
