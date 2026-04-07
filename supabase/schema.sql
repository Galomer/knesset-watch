-- ── Knesset Watch — Database Schema ─────────────────────────────────────────
-- Run this in the Supabase SQL Editor (project → SQL Editor → New query)

-- Factions (parties)
create table if not exists factions (
  faction_id   integer      primary key,
  name         text         not null,
  name_eng     text         not null default '',
  knesset_num  integer      not null default 25,
  is_current   boolean      not null default true,
  is_coalition boolean      not null default false,
  updated_at   timestamptz  not null default now()
);

-- Members (MKs)
create table if not exists members (
  person_id       integer      primary key,
  full_name       text         not null,
  full_name_eng   text         not null default '',
  faction_id      integer      references factions(faction_id),
  faction_name    text         not null default '',
  faction_name_eng text        not null default '',
  role_he         text         not null default '',
  role_eng        text         not null default '',
  email           text,
  gender_id       integer,
  is_current      boolean      not null default true,
  updated_at      timestamptz  not null default now()
);

-- Bills (K25 — passed + all initiated by current MKs)
create table if not exists bills (
  bill_id           integer      primary key,
  name              text,
  knesset_num       integer      not null default 25,
  status_id         integer,
  is_government     boolean      not null default false,
  publication_date  date,
  updated_at        timestamptz  not null default now()
);

-- Who initiated each bill
create table if not exists bill_initiators (
  bill_id     integer  not null references bills(bill_id) on delete cascade,
  person_id   integer  not null,
  is_initiator boolean not null default true,
  primary key (bill_id, person_id)
);

-- Sync job log
create table if not exists sync_log (
  id              serial       primary key,
  sync_type       text         not null,
  started_at      timestamptz  not null default now(),
  completed_at    timestamptz,
  records_synced  integer      not null default 0,
  status          text         not null default 'running',  -- running | success | failed
  error           text
);

-- Indexes
create index if not exists idx_members_faction    on members(faction_id);
create index if not exists idx_members_current    on members(is_current);
create index if not exists idx_bills_knesset      on bills(knesset_num, status_id);
create index if not exists idx_initiators_person  on bill_initiators(person_id);
create index if not exists idx_initiators_bill    on bill_initiators(bill_id);
create index if not exists idx_sync_log_type      on sync_log(sync_type, started_at desc);
