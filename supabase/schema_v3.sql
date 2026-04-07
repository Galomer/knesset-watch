-- ── Schema v3 — Bill Classifications ─────────────────────────────────────────
-- Run in Supabase SQL Editor after schema_v2.sql

create table if not exists bill_classifications (
  bill_id          integer  primary key references bills(bill_id) on delete cascade,

  -- Which populations benefit / are hurt
  benefits         text[]   not null default '{}',
  hurts            text[]   not null default '{}',

  -- Financial impact on a middle-class Israeli family
  financial_impact text     not null default 'unknown',  -- positive | negative | neutral | unknown
  financial_note   text     not null default '',

  -- Stance per group: pro | neutral | anti
  seniors          text     not null default 'neutral',
  children         text     not null default 'neutral',
  lgbt             text     not null default 'neutral',
  ultra_orthodox   text     not null default 'neutral',
  religious        text     not null default 'neutral',
  liberals         text     not null default 'neutral',
  women            text     not null default 'neutral',
  soldiers         text     not null default 'neutral',
  working_class    text     not null default 'neutral',
  unemployed       text     not null default 'neutral',
  arabs            text     not null default 'neutral',
  druze            text     not null default 'neutral',
  secular          text     not null default 'neutral',

  -- Meta
  confidence       text     not null default 'medium',   -- high | medium | low
  classified_at    timestamptz not null default now()
);

create index if not exists idx_classifications_bill on bill_classifications(bill_id);

-- Index each stance column for fast group-based filtering
create index if not exists idx_class_seniors       on bill_classifications(seniors);
create index if not exists idx_class_children      on bill_classifications(children);
create index if not exists idx_class_lgbt          on bill_classifications(lgbt);
create index if not exists idx_class_ultra_orthodox on bill_classifications(ultra_orthodox);
create index if not exists idx_class_women         on bill_classifications(women);
create index if not exists idx_class_soldiers      on bill_classifications(soldiers);
create index if not exists idx_class_working_class on bill_classifications(working_class);
create index if not exists idx_class_arabs         on bill_classifications(arabs);

-- Helper function: returns bills that haven't been classified yet
create or replace function get_unclassified_bills(p_knesset integer, p_limit integer)
returns table(bill_id integer, name text, knesset_num integer, status_id integer) as $$
  select b.bill_id, b.name, b.knesset_num, b.status_id
  from bills b
  left join bill_classifications bc on bc.bill_id = b.bill_id
  where b.knesset_num = p_knesset
    and b.name is not null
    and bc.bill_id is null
  order by b.bill_id
  limit p_limit;
$$ language sql stable;
