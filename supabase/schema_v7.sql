-- ── Schema v7 — Rich bill summaries ──────────────────────────────────────────
-- Run in Supabase SQL Editor after schema_v6.sql

alter table bill_classifications
  add column if not exists full_summary     text not null default '',
  add column if not exists benefits_summary text not null default '',
  add column if not exists concerns_summary text not null default '';
