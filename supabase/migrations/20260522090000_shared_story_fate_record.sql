alter table public.shared_stories
  add column if not exists fate_record jsonb;
