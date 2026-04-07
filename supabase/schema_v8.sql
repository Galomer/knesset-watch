-- ── Schema v8 — Vote AI summaries ─────────────────────────────────────────────
-- Run in Supabase SQL Editor after schema_v7.sql

alter table vote_headers
  add column if not exists ai_summary text not null default '';
