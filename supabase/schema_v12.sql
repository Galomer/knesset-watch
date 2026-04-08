-- schema_v12: add population impact fields to member_political_profiles
-- Run in Supabase SQL Editor

alter table member_political_profiles
  add column if not exists primary_beneficiaries jsonb not null default '[]',
  add column if not exists primary_hurt          jsonb not null default '[]',
  add column if not exists population_note       text  not null default '';
