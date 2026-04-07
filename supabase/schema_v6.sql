-- ── Schema v6 — Voting data ───────────────────────────────────────────────────
-- Run in Supabase SQL Editor after schema_v5.sql

-- Vote headers (one row per Knesset vote session item)
create table if not exists vote_headers (
  vote_id        integer  primary key,
  knesset_num    integer  not null,
  vote_date      date,
  vote_time      text,
  description    text,                        -- sess_item_dscr
  item_desc      text,                        -- vote_item_dscr (e.g. "הצבעה", "הצעת סיכום")
  is_accepted    boolean,
  total_for      integer,
  total_against  integer,
  total_abstain  integer
);

create index if not exists idx_vote_headers_knesset on vote_headers(knesset_num);
create index if not exists idx_vote_headers_date    on vote_headers(vote_date desc);

-- Per-MK vote results
create table if not exists member_votes (
  person_id   integer not null,
  vote_id     integer not null references vote_headers(vote_id) on delete cascade,
  vote_result smallint not null,   -- 1=for 2=against 3=abstain 4=absent 0=cancelled
  knesset_num integer,
  primary key (person_id, vote_id)
);

create index if not exists idx_member_votes_person  on member_votes(person_id);
create index if not exists idx_member_votes_vote    on member_votes(vote_id);

-- Tracks which members have had their votes synced
create table if not exists vote_sync_log (
  person_id    integer primary key,
  synced_at    timestamptz not null default now(),
  vote_count   integer not null default 0
);
