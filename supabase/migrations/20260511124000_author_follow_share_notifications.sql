alter table public.stories
  add column if not exists share_count integer not null default 0;

create table if not exists public.author_follows (
  follower_id text not null,
  author_id text not null,
  author_name text not null default '',
  created_at timestamptz not null default now(),
  primary key (follower_id, author_id)
);

create index if not exists idx_author_follows_author_created
  on public.author_follows (author_id, created_at desc);

create table if not exists public.user_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  type text not null,
  title text not null,
  body text not null,
  story_id text,
  author_id text,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index if not exists idx_user_notifications_user_created
  on public.user_notifications (user_id, created_at desc);

create table if not exists public.push_subscriptions (
  user_id text not null,
  endpoint text not null,
  subscription jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, endpoint)
);

create index if not exists idx_push_subscriptions_user
  on public.push_subscriptions (user_id);
