create extension if not exists pgcrypto;

create table if not exists public.stories (
  id text primary key default gen_random_uuid()::text,
  title text not null,
  main_axis text not null default '',
  tags jsonb not null default '[]'::jsonb,
  cover_url text not null default '',
  author_id text not null,
  author_name text not null default '',
  visibility text not null default 'private' check (visibility in ('public', 'unlisted', 'private')),
  popularity integer not null default 0,
  like_count integer not null default 0,
  intervention_count integer not null default 0,
  favorite_count integer not null default 0,
  report_count integer not null default 0,
  average_chapter_words integer not null default 0,
  chapter_count integer not null default 0,
  card_excerpt text not null default '',
  allow_adaptation boolean not null default false,
  ending_mode text not null default 'dual' check (ending_mode in ('dual', 'single')),
  ending_rates jsonb not null default '{"left":40,"right":40}'::jsonb,
  ending_names jsonb not null default '{}'::jsonb,
  defaults jsonb not null default '{"targetWordCount":800,"paragraphs":{"min":6,"max":10}}'::jsonb,
  characters jsonb not null default '[]'::jsonb,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.story_chapters (
  story_id text not null references public.stories(id) on delete cascade,
  chapter_num integer not null check (chapter_num between 1 and 10),
  title text not null default '',
  summary text not null default '',
  present_characters jsonb not null default '[]'::jsonb,
  text text not null default '',
  primary key (story_id, chapter_num)
);

create table if not exists public.story_endings (
  story_id text not null references public.stories(id) on delete cascade,
  id text not null,
  chapter_num integer not null default 7,
  title text not null default '',
  text text not null default '',
  key_nodes jsonb not null default '[]'::jsonb,
  primary key (story_id, id)
);

create table if not exists public.story_branches (
  id text primary key default gen_random_uuid()::text,
  story_id text not null references public.stories(id) on delete cascade,
  side text not null default 'left' check (side in ('left', 'right')),
  tier text not null default 'small' check (tier in ('small', 'medium', 'large', 'hidden')),
  name text not null default '',
  hint text not null default '',
  description text not null default '',
  trigger jsonb not null default '{}'::jsonb,
  trigger_groups jsonb not null default '[]'::jsonb,
  common boolean not null default false,
  inject jsonb not null default '{"mustHappen":[],"mustReveal":[],"mustChange":[]}'::jsonb,
  scene_text text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.shared_stories (
  id text primary key default gen_random_uuid()::text,
  title text not null,
  main_axis text not null default '',
  tags jsonb not null default '[]'::jsonb,
  characters jsonb not null default '[]'::jsonb,
  chapters jsonb not null default '[]'::jsonb,
  author_id text not null,
  author_name text not null default '',
  original_author_id text,
  original_author_name text not null default '',
  intervener_id text,
  intervener_name text not null default '',
  cover_url text not null default '',
  source_story_id text,
  average_chapter_words integer not null default 0,
  chapter_count integer not null default 0,
  card_excerpt text not null default '',
  allow_adaptation boolean not null default false,
  visibility text not null default 'public' check (visibility in ('public', 'private')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_progress (
  user_id text not null,
  story_id text not null,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, story_id)
);

create table if not exists public.story_likes (
  story_id text not null references public.stories(id) on delete cascade,
  user_id text not null,
  created_at timestamptz not null default now(),
  primary key (story_id, user_id)
);

create table if not exists public.story_favorites (
  story_id text not null references public.stories(id) on delete cascade,
  user_id text not null,
  created_at timestamptz not null default now(),
  primary key (story_id, user_id)
);

create table if not exists public.story_reports (
  id text primary key default gen_random_uuid()::text,
  story_id text not null references public.stories(id) on delete cascade,
  user_id text not null,
  reason text not null default '',
  created_at timestamptz not null default now(),
  unique (story_id, user_id)
);

create table if not exists public.app_settings (
  id text primary key,
  payload jsonb not null default '{}'::jsonb,
  updated_by text,
  updated_at timestamptz not null default now()
);

create table if not exists public.cover_generation_usage (
  user_id text not null,
  date_key text not null,
  count integer not null default 0 check (count >= 0 and count <= 5),
  updated_at timestamptz not null default now(),
  primary key (user_id, date_key)
);

create index if not exists idx_stories_public_updated on public.stories (visibility, updated_at desc);
create index if not exists idx_stories_author_updated on public.stories (author_id, updated_at desc);
create index if not exists idx_shared_author_updated on public.shared_stories (author_id, updated_at desc);
create index if not exists idx_shared_source on public.shared_stories (source_story_id);
create index if not exists idx_story_branches_story on public.story_branches (story_id);

alter table public.stories enable row level security;
alter table public.story_chapters enable row level security;
alter table public.story_endings enable row level security;
alter table public.story_branches enable row level security;
alter table public.shared_stories enable row level security;
alter table public.user_progress enable row level security;
alter table public.story_likes enable row level security;
alter table public.story_favorites enable row level security;
alter table public.story_reports enable row level security;
alter table public.app_settings enable row level security;
alter table public.cover_generation_usage enable row level security;

drop policy if exists stories_public_read on public.stories;
create policy stories_public_read on public.stories for select using (visibility in ('public', 'unlisted'));

drop policy if exists story_chapters_public_read on public.story_chapters;
create policy story_chapters_public_read on public.story_chapters for select using (
  exists (select 1 from public.stories s where s.id = story_id and s.visibility in ('public', 'unlisted'))
);

drop policy if exists story_endings_public_read on public.story_endings;
create policy story_endings_public_read on public.story_endings for select using (
  exists (select 1 from public.stories s where s.id = story_id and s.visibility in ('public', 'unlisted'))
);

drop policy if exists story_branches_public_read on public.story_branches;
create policy story_branches_public_read on public.story_branches for select using (
  exists (select 1 from public.stories s where s.id = story_id and s.visibility in ('public', 'unlisted'))
);

drop policy if exists shared_stories_public_read on public.shared_stories;
create policy shared_stories_public_read on public.shared_stories for select using (visibility = 'public');

drop policy if exists app_settings_public_read on public.app_settings;
create policy app_settings_public_read on public.app_settings for select using (true);
