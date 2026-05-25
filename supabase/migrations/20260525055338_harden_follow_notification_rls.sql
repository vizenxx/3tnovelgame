alter table public.author_follows enable row level security;
alter table public.user_notifications enable row level security;
alter table public.push_subscriptions enable row level security;

-- These tables are accessed through the server-side aggregated story-store API
-- with the service role key. Do not add broad anon/authenticated policies here:
-- the app currently uses Firebase Auth IDs, not Supabase Auth uid claims.
