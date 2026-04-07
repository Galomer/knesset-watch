-- ── Schema v2 — Run in Supabase SQL Editor after schema.sql ──────────────────

-- Track resumable sync progress
create table if not exists sync_progress (
  id           text        primary key,   -- e.g. 'bills_k25', 'bills_k24', 'members_all'
  last_skip    integer     not null default 0,
  total_synced integer     not null default 0,
  is_done      boolean     not null default false,
  updated_at   timestamptz not null default now()
);

-- Add last_updated_date to bills (used for incremental daily sync)
alter table bills add column if not exists last_updated_date timestamptz;

-- Store ALL MKs (current and historical), not just current
alter table members add column if not exists knesset_num integer not null default 25;

-- Allow multiple rows per person across Knessets
-- (person_id alone is no longer unique — use (person_id, knesset_num) instead)
-- We keep person_id as PK but store the most recent Knesset data per person.
-- Historical career stats are derived from bill_initiators across all knesset_nums on bills.

create index if not exists idx_sync_progress on sync_progress(is_done);
create index if not exists idx_bills_updated  on bills(last_updated_date);
create index if not exists idx_bills_knesset_all on bills(knesset_num);
