alter table public.shared_stories
  add column if not exists snapshot_kind text not null default 'intervened'
    check (snapshot_kind in ('intervened', 'saved_run')),
  add column if not exists content_hash text not null default '';

create index if not exists idx_shared_snapshot_dedupe
  on public.shared_stories (author_id, source_story_id, content_hash, snapshot_kind);

create or replace function public.unfavorite_story_once(p_story_id text, p_user_id text)
returns jsonb
language plpgsql
as $$
declare
  removed_count integer;
begin
  delete from public.story_favorites
    where story_id = p_story_id
      and user_id = p_user_id;

  get diagnostics removed_count = row_count;

  if removed_count > 0 then
    update public.stories
      set favorite_count = greatest(favorite_count - 1, 0),
          updated_at = now()
      where id = p_story_id;
    return jsonb_build_object('removed', true);
  end if;

  return jsonb_build_object('removed', false);
end;
$$;
