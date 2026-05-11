create or replace function public.increment_story_metric(p_story_id text, p_field text)
returns jsonb
language plpgsql
as $$
begin
  if p_field = 'interventionCount' then
    update public.stories
      set intervention_count = intervention_count + 1,
          popularity = popularity + 1
      where id = p_story_id;
  elsif p_field = 'favoriteCount' then
    update public.stories
      set favorite_count = favorite_count + 1
      where id = p_story_id;
  elsif p_field = 'reportCount' then
    update public.stories
      set report_count = report_count + 1
      where id = p_story_id;
  else
    raise exception 'Invalid metric field: %', p_field;
  end if;
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.like_story_once(p_story_id text, p_user_id text)
returns jsonb
language plpgsql
as $$
begin
  insert into public.story_likes (story_id, user_id)
  values (p_story_id, p_user_id)
  on conflict do nothing;

  if found then
    update public.stories
      set like_count = like_count + 1
      where id = p_story_id;
    return jsonb_build_object('alreadyExists', false);
  end if;

  return jsonb_build_object('alreadyExists', true);
end;
$$;

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
      set like_count = greatest(like_count - 1, 0)
      where id = p_story_id;
    return jsonb_build_object('removed', true);
  end if;

  return jsonb_build_object('removed', false);
end;
$$;

create or replace function public.favorite_story_once(p_story_id text, p_user_id text)
returns jsonb
language plpgsql
as $$
begin
  insert into public.story_favorites (story_id, user_id)
  values (p_story_id, p_user_id)
  on conflict do nothing;

  if found then
    update public.stories
      set favorite_count = favorite_count + 1
      where id = p_story_id;
    return jsonb_build_object('alreadyExists', false);
  end if;

  return jsonb_build_object('alreadyExists', true);
end;
$$;

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
      set favorite_count = greatest(favorite_count - 1, 0)
      where id = p_story_id;
    return jsonb_build_object('removed', true);
  end if;

  return jsonb_build_object('removed', false);
end;
$$;

create or replace function public.report_story_once(p_story_id text, p_user_id text, p_reason text default '')
returns jsonb
language plpgsql
as $$
begin
  insert into public.story_reports (story_id, user_id, reason)
  values (p_story_id, p_user_id, coalesce(p_reason, ''))
  on conflict do nothing;

  if found then
    update public.stories
      set report_count = report_count + 1
      where id = p_story_id;
    return jsonb_build_object('alreadyExists', false);
  end if;

  return jsonb_build_object('alreadyExists', true);
end;
$$;
