-- Cache for the "মেকানিক টিপস" YouTube search (api/youtube-search.ts).
-- Run this once in the Supabase SQL Editor. It only ADDS a new table;
-- nothing existing is touched.
--
-- Only the server (service-role key) reads/writes this table. RLS is on
-- with no policies, so the app's public/anon key cannot see it at all.

create table if not exists public.youtube_cache (
  cache_key  text primary key,
  results    jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists youtube_cache_created_at_idx
  on public.youtube_cache (created_at);

alter table public.youtube_cache enable row level security;

revoke all on public.youtube_cache from anon, authenticated;
