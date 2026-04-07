-- schema_v10: member political profiles
-- Run in Supabase SQL Editor

create table if not exists member_political_profiles (
  person_id          integer primary key,

  -- Political axes (0–100)
  -- left_right_score: 0 = far left, 50 = center, 100 = far right
  left_right_score   smallint not null check (left_right_score between 0 and 100),
  -- extremism_score: 0 = moderate, 100 = extreme
  extremism_score    smallint not null check (extremism_score between 0 and 100),

  -- Issue stances: -2 strongly anti, -1 anti, 0 neutral, 1 pro, 2 strongly pro
  stance_women       smallint not null default 0 check (stance_women    between -2 and 2),
  stance_lgbt        smallint not null default 0 check (stance_lgbt     between -2 and 2),
  stance_military    smallint not null default 0 check (stance_military between -2 and 2),
  stance_democracy   smallint not null default 0 check (stance_democracy between -2 and 2),

  -- Behavioral scores (0–100)
  propaganda_score   smallint not null default 0 check (propaganda_score  between 0 and 100),
  hypocrisy_score    smallint not null default 0 check (hypocrisy_score   between 0 and 100),

  -- Narrative analysis
  political_summary  text not null default '',
  stance_notes       jsonb not null default '{}',
  propaganda_note    text not null default '',
  hypocrisy_note     text not null default '',

  -- Meta
  generated_at       timestamptz not null default now()
);
