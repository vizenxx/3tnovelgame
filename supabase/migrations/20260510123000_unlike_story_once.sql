create or replace function public.unlike_story_once(p_story_id text, p_user_id text)
returns jsonb
language plpgsql
as $$
declare
  removed_count integer;
begin
  delete from public.story_likes
    where story_id = p_story_id
      and user_id = p_user_id;

  get diagnostics removed_count = row_count;

  if removed_count > 0 then
    update public.stories
      set like_count = greatest(like_count - 1, 0),
          updated_at = now()
      where id = p_story_id;
    return jsonb_build_object('removed', true);
  end if;

  return jsonb_build_object('removed', false);
end;
$$;
