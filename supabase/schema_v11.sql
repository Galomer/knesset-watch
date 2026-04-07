-- schema_v11: update political profiles — new stance columns
-- Run in Supabase SQL Editor

alter table member_political_profiles
  add column if not exists stance_liberalism   smallint not null default 0 check (stance_liberalism   between -2 and 2),
  add column if not exists stance_army         smallint not null default 0 check (stance_army         between -2 and 2),
  add column if not exists stance_settlements  smallint not null default 0 check (stance_settlements  between -2 and 2);
