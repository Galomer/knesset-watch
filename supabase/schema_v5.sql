-- ── Schema v5 — Add status_desc to bills ─────────────────────────────────────
-- Run in Supabase SQL Editor after schema_v4.sql

alter table bills
  add column if not exists status_desc text;

-- Reset bills_k25 sync progress so the full re-sync will run again
-- (needed to repopulate status_id and status_desc after the original bug)
update sync_progress set is_done = false, last_skip = 0, total_synced = 0
where id = 'bills_k25';
