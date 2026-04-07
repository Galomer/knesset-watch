-- schema_v9: member news cache
-- Run in Supabase SQL Editor

create table if not exists member_news (
  id           bigserial primary key,
  person_id    integer not null,
  title        text not null,
  url          text not null,
  source       text,
  published_at timestamptz,
  snippet      text,
  ai_summary   text not null default '',
  fetched_at   timestamptz not null default now(),
  unique(person_id, url)
);

create index if not exists member_news_person_fetched
  on member_news(person_id, fetched_at desc);
