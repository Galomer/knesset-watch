-- ── Schema v4 — Add summary to bill_classifications ──────────────────────────
-- Run in Supabase SQL Editor after schema_v3.sql

alter table bill_classifications
  add column if not exists summary text not null default '';
