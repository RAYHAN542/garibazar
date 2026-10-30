-- Run ONCE in Supabase SQL editor BEFORE using the migration button.
alter table public.listings
  add column if not exists legacy_image_urls text[] not null default '{}';
