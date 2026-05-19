create table if not exists public.series_worlds (
  id text primary key default gen_random_uuid()::text,
  author_id text not null,
  author_name text not null default '',
  title text not null default '',
  pitch text not null default '',
  genre_tags jsonb not null default '[]'::jsonb,
  world_bible jsonb not null default '{}'::jsonb,
  timeline_notes text not null default '',
  iron_laws jsonb not null default '[]'::jsonb,
  future_directions jsonb not null default '[]'::jsonb,
  visibility text not null default 'private' check (visibility in ('private', 'unlisted', 'public')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.series_entries (
  series_id text not null references public.series_worlds(id) on delete cascade,
  story_id text not null references public.stories(id) on delete cascade,
  entry_order integer not null default 1,
  entry_type text not null default 'main' check (entry_type in ('main', 'sequel', 'prequel', 'side')),
  timeline_label text not null default '',
  created_at timestamptz not null default now(),
  primary key (series_id, story_id)
);

create table if not exists public.continuity_nodes (
  id text primary key default gen_random_uuid()::text,
  series_id text not null references public.series_worlds(id) on delete cascade,
  source_story_id text references public.stories(id) on delete set null,
  target_story_id text references public.stories(id) on delete set null,
  title text not null default '',
  ending_domain text not null default 'middle' check (ending_domain in ('left', 'middle', 'right')),
  ending_id text not null default 'default',
  required_branch_ids jsonb not null default '[]'::jsonb,
  optional_branch_ids jsonb not null default '[]'::jsonb,
  bridge_summary text not null default '',
  legacy_state jsonb not null default '{}'::jsonb,
  repair_rules jsonb not null default '[]'::jsonb,
  sequel_seed_prompt text not null default '',
  visibility text not null default 'private' check (visibility in ('private', 'unlisted', 'public')),
  created_by text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.stories
  add column if not exists series_id text references public.series_worlds(id) on delete set null,
  add column if not exists series_role text not null default 'standalone' check (series_role in ('standalone', 'main', 'sequel', 'prequel', 'side')),
  add column if not exists continuity_node_id text references public.continuity_nodes(id) on delete set null,
  add column if not exists series_constraints jsonb not null default '{}'::jsonb;

create index if not exists idx_series_worlds_author_updated on public.series_worlds (author_id, updated_at desc);
create index if not exists idx_series_entries_series_order on public.series_entries (series_id, entry_order);
create index if not exists idx_series_entries_story on public.series_entries (story_id);
create index if not exists idx_continuity_nodes_series_updated on public.continuity_nodes (series_id, updated_at desc);
create index if not exists idx_continuity_nodes_source_story on public.continuity_nodes (source_story_id);
create index if not exists idx_stories_series on public.stories (series_id, updated_at desc);

alter table public.series_worlds enable row level security;
alter table public.series_entries enable row level security;
alter table public.continuity_nodes enable row level security;

drop policy if exists series_worlds_public_read on public.series_worlds;
create policy series_worlds_public_read on public.series_worlds for select using (visibility in ('public', 'unlisted'));

drop policy if exists series_entries_public_read on public.series_entries;
create policy series_entries_public_read on public.series_entries for select using (
  exists (
    select 1 from public.series_worlds s
    where s.id = series_id and s.visibility in ('public', 'unlisted')
  )
);

drop policy if exists continuity_nodes_public_read on public.continuity_nodes;
create policy continuity_nodes_public_read on public.continuity_nodes for select using (visibility in ('public', 'unlisted'));

grant select, insert, update, delete on public.series_worlds to authenticated;
grant select, insert, update, delete on public.series_entries to authenticated;
grant select, insert, update, delete on public.continuity_nodes to authenticated;
grant select on public.series_worlds to anon;
grant select on public.series_entries to anon;
grant select on public.continuity_nodes to anon;
