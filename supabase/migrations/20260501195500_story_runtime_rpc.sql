create or replace function public.get_story_cartridge(p_story_id text)
returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'meta', to_jsonb(s),
    'chapters', coalesce((
      select jsonb_agg(to_jsonb(c) order by c.chapter_num asc)
      from public.story_chapters c
      where c.story_id = p_story_id
    ), '[]'::jsonb),
    'endings', coalesce((
      select jsonb_agg(to_jsonb(e) order by e.id asc)
      from public.story_endings e
      where e.story_id = p_story_id
    ), '[]'::jsonb),
    'branches', coalesce((
      select jsonb_agg(to_jsonb(b) order by b.created_at asc)
      from public.story_branches b
      where b.story_id = p_story_id
    ), '[]'::jsonb)
  )
  from public.stories s
  where s.id = p_story_id
  limit 1;
$$;

create or replace function public.increment_story_metric(p_story_id text, p_field text)
returns jsonb
language plpgsql
as $$
begin
  if p_field = 'interventionCount' then
    update public.stories
      set intervention_count = intervention_count + 1,
          popularity = popularity + 1,
          updated_at = now()
      where id = p_story_id;
  elsif p_field = 'favoriteCount' then
    update public.stories
      set favorite_count = favorite_count + 1,
          updated_at = now()
      where id = p_story_id;
  elsif p_field = 'reportCount' then
    update public.stories
      set report_count = report_count + 1,
          updated_at = now()
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
      set like_count = like_count + 1,
          updated_at = now()
      where id = p_story_id;
    return jsonb_build_object('alreadyExists', false);
  end if;

  return jsonb_build_object('alreadyExists', true);
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
      set favorite_count = favorite_count + 1,
          updated_at = now()
      where id = p_story_id;
    return jsonb_build_object('alreadyExists', false);
  end if;

  return jsonb_build_object('alreadyExists', true);
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
      set report_count = report_count + 1,
          updated_at = now()
      where id = p_story_id;
    return jsonb_build_object('alreadyExists', false);
  end if;

  return jsonb_build_object('alreadyExists', true);
end;
$$;

create or replace function public.reserve_cover_usage(p_user_id text, p_date_key text, p_limit integer default 5)
returns integer
language plpgsql
as $$
declare
  next_count integer;
begin
  insert into public.cover_generation_usage (user_id, date_key, count, updated_at)
  values (p_user_id, p_date_key, 0, now())
  on conflict (user_id, date_key) do nothing;

  update public.cover_generation_usage
    set count = count + 1,
        updated_at = now()
    where user_id = p_user_id
      and date_key = p_date_key
      and count < p_limit
    returning count into next_count;

  if next_count is null then
    raise exception 'Today cover generation quota is used up.';
  end if;

  return greatest(0, p_limit - next_count);
end;
$$;

create or replace function public.refund_cover_usage(p_user_id text, p_date_key text)
returns jsonb
language plpgsql
as $$
begin
  update public.cover_generation_usage
    set count = greatest(0, count - 1),
        updated_at = now()
    where user_id = p_user_id
      and date_key = p_date_key;

  return jsonb_build_object('ok', true);
end;
$$;
