alter table public.shared_stories
  drop constraint if exists shared_stories_visibility_check;

alter table public.shared_stories
  add constraint shared_stories_visibility_check
  check (visibility in ('public', 'private', 'unlisted'));

update public.shared_stories
set visibility = 'unlisted',
    updated_at = now()
where visibility = 'public';

alter table public.shared_stories
  alter column visibility set default 'unlisted';

alter table public.shared_stories
  drop constraint if exists shared_stories_visibility_check;

alter table public.shared_stories
  add constraint shared_stories_visibility_check
  check (visibility in ('private', 'unlisted'));

drop policy if exists shared_stories_public_read on public.shared_stories;
create policy shared_stories_public_read
  on public.shared_stories
  for select
  using (visibility = 'unlisted');
