-- Favalog: Phase 4B.1 — Follow Lifecycle and Follower-Only Lists.
--
-- 1. Atomic, idempotent `public.set_follow(...)` RPC for following and unfollowing
--    a user by canonical public username.
-- 2. Updated `public.create_list` and `public.update_list` RPCs accepting
--    'followers' visibility in addition to 'public' and 'private'.
-- 3. Follower-aware Row Level Security SELECT policies on `public.lists` and
--    `public.list_items`.
--
-- SECURITY MODEL — SECURITY INVOKER:
--   * `set_follow` runs with the caller's identity (auth.uid()), with RLS in force.
--   * search_path is pinned to '' and all references are schema-qualified.
--   * EXECUTE is revoked from public/anon and granted only to authenticated.
--   * Target identity is resolved server-side from canonical username.
--   * Self-follow is rejected with errcode 22023.
--   * Concurrency is serialized on the (follower, target) pair using a transaction-scoped
--     advisory lock (pg_catalog.pg_advisory_xact_lock) that works even when no row exists.
--   * Returns { target_username, target_user_id, is_following, changed }.

-- ---------------------------------------------------------------------------
-- 1. public.set_follow RPC
-- ---------------------------------------------------------------------------
create or replace function public.set_follow(
  p_target_username text,
  p_is_follow       boolean
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid             uuid := auth.uid();
  v_raw_username    text;
  v_target_id       uuid;
  v_target_username text;
  v_rows            int;
  v_changed         boolean := false;
begin
  if v_uid is null then
    raise exception 'authentication required'
      using errcode = '28000',
            hint = 'set_follow must be called by an authenticated user';
  end if;

  if p_is_follow is null then
    raise exception 'invalid follow state'
      using errcode = '22023',
            hint = 'is_follow must be true or false';
  end if;

  v_raw_username := btrim(coalesce(p_target_username, ''));
  if v_raw_username = '' or char_length(v_raw_username) < 3 or char_length(v_raw_username) > 30 or v_raw_username !~ '^[A-Za-z0-9_]{3,30}$' then
    raise exception 'invalid username: %', coalesce(p_target_username, '(null)')
      using errcode = '22023',
            hint = 'username must be 3-30 characters of alphanumeric or underscore';
  end if;

  -- Resolve the target profile by canonical case-insensitive username.
  select p.id, p.username::text into v_target_id, v_target_username
  from public.profiles p
  where lower(p.username::text) = lower(v_raw_username);

  if v_target_id is null then
    raise exception 'unknown profile: %', p_target_username
      using errcode = 'P0002',
            hint = 'no profile matches the provided username';
  end if;

  if v_uid = v_target_id then
    raise exception 'cannot follow self'
      using errcode = '22023',
            hint = 'a user cannot follow their own profile';
  end if;

  -- Transaction-scoped advisory lock on the (follower, target) pair.
  -- This serializes concurrent opposite-state or duplicate operations for this exact pair,
  -- and works reliably even when no row exists in public.follows.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext(v_uid::text),
    pg_catalog.hashtext(v_target_id::text)
  );

  if p_is_follow then
    -- Idempotent follow: insert on conflict do nothing.
    insert into public.follows (follower_id, following_id)
    values (v_uid, v_target_id)
    on conflict (follower_id, following_id) do nothing;
    get diagnostics v_rows = row_count;
    v_changed := (v_rows > 0);
  else
    -- Idempotent unfollow: delete if present.
    delete from public.follows
    where follower_id = v_uid
      and following_id = v_target_id;
    get diagnostics v_rows = row_count;
    v_changed := (v_rows > 0);
  end if;

  return jsonb_build_object(
    'target_username', v_target_username,
    'target_user_id',  v_target_id,
    'is_following',    p_is_follow,
    'changed',         v_changed
  );
end;
$$;

comment on function public.set_follow(text, boolean) is
  'Atomically and idempotently sets the authenticated caller''s follow relationship for a target profile. SECURITY INVOKER with pinned search_path; serializes on (follower, following) with transaction advisory lock. Returns { target_username, target_user_id, is_following, changed }.';

revoke all on function public.set_follow(text, boolean) from public;
revoke all on function public.set_follow(text, boolean) from anon;
grant execute on function public.set_follow(text, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Update create_list and update_list RPCs to accept 'followers' visibility
-- ---------------------------------------------------------------------------
create or replace function public.create_list(
  p_title       text,
  p_description text    default null,
  p_is_ranked   boolean default false,
  p_visibility  text    default 'public',
  p_media_slug  text    default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid         uuid := auth.uid();
  v_title       text := btrim(coalesce(p_title, ''));
  v_description text := nullif(btrim(coalesce(p_description, '')), '');
  v_visibility  public.list_visibility;
  v_username    text;
  v_user_slug   text;
  v_title_slug  text;
  v_base        text;
  v_slug        text;
  v_suffix      int := 1;
  v_list_id     uuid;
  v_media_id    uuid;
  v_added_slug  text := null;
begin
  if v_uid is null then
    raise exception 'authentication required'
      using errcode = '28000',
            hint = 'create_list must be called by an authenticated user';
  end if;

  -- Validate the title and description up front for clean, mapped errors
  -- (the table CHECKs enforce the same bounds as a second boundary).
  if char_length(v_title) < 1 or char_length(v_title) > 150 then
    raise exception 'invalid list title'
      using errcode = '22023',
            hint = 'title must be between 1 and 150 characters';
  end if;
  if v_description is not null and char_length(v_description) > 2000 then
    raise exception 'invalid list description'
      using errcode = '22023',
            hint = 'description must be 2000 characters or fewer';
  end if;

  -- 'public', 'followers', and 'private' are accepted.
  if p_visibility = 'public' then
    v_visibility := 'public';
  elsif p_visibility = 'followers' then
    v_visibility := 'followers';
  elsif p_visibility = 'private' then
    v_visibility := 'private';
  else
    raise exception 'invalid list visibility: %', coalesce(p_visibility, '(null)')
      using errcode = '22023',
            hint = 'visibility must be ''public'', ''followers'', or ''private''';
  end if;

  -- Build a readable slug base from the owner username + list title.
  select p.username::text into v_username
  from public.profiles p
  where p.id = v_uid;

  v_user_slug  := btrim(regexp_replace(lower(coalesce(v_username, '')), '[^a-z0-9]+', '-', 'g'), '-');
  v_title_slug := btrim(regexp_replace(lower(v_title), '[^a-z0-9]+', '-', 'g'), '-');
  v_base := btrim(concat_ws('-', nullif(v_user_slug, ''), nullif(v_title_slug, '')), '-');
  if v_base is null or v_base = '' then
    v_base := 'list';
  end if;
  v_slug := v_base;

  -- Insert with a collision-safe suffix. The INSERT (not a pre-read) is the
  -- authority for uniqueness, so this is correct even for slugs of other users'
  -- private lists that RLS would hide from a SELECT. Both the global and the
  -- per-owner unique indexes are slug-based, so bumping the suffix resolves
  -- either violation.
  loop
    begin
      insert into public.lists (user_id, slug, title, description, is_ranked, visibility)
      values (v_uid, v_slug, v_title, v_description, coalesce(p_is_ranked, false), v_visibility)
      returning id into v_list_id;
      exit;
    exception
      when unique_violation then
        v_suffix := v_suffix + 1;
        v_slug := v_base || '-' || v_suffix::text;
        if v_suffix > 1000 then
          raise exception 'could not generate a unique list slug'
            using errcode = '54000',
                  hint = 'too many slug collisions for this list title';
        end if;
    end;
  end loop;

  -- Atomically add the initial media item when requested.
  if p_media_slug is not null and btrim(p_media_slug) <> '' then
    select mi.id, mi.slug into v_media_id, v_added_slug
    from public.media_items mi
    where mi.slug = btrim(p_media_slug);

    if v_media_id is null then
      raise exception 'unknown media slug: %', p_media_slug
        using errcode = 'P0002',
              hint = 'no catalog title matches the provided media slug';
    end if;

    insert into public.list_items (list_id, media_id, position)
    values (v_list_id, v_media_id, 0);
  end if;

  return jsonb_build_object(
    'list_id',          v_list_id,
    'slug',             v_slug,
    'added_media_slug', v_added_slug
  );
end;
$$;

create or replace function public.update_list(
  p_list_id     uuid,
  p_title       text,
  p_description text    default null,
  p_is_ranked   boolean default false,
  p_visibility  text    default 'public'
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid         uuid := auth.uid();
  v_title       text := btrim(coalesce(p_title, ''));
  v_description text := nullif(btrim(coalesce(p_description, '')), '');
  v_visibility  public.list_visibility;
  v_slug        text;
  v_media_slugs text[];
begin
  if v_uid is null then
    raise exception 'authentication required'
      using errcode = '28000',
            hint = 'update_list must be called by an authenticated user';
  end if;

  -- Validate the title and description up front for clean, mapped errors
  -- (the table CHECKs enforce the same bounds as a second boundary). Rules and
  -- normalization mirror create_list exactly.
  if char_length(v_title) < 1 or char_length(v_title) > 150 then
    raise exception 'invalid list title'
      using errcode = '22023',
            hint = 'title must be between 1 and 150 characters';
  end if;
  if v_description is not null and char_length(v_description) > 2000 then
    raise exception 'invalid list description'
      using errcode = '22023',
            hint = 'description must be 2000 characters or fewer';
  end if;

  -- 'public', 'followers', and 'private' are accepted.
  if p_visibility = 'public' then
    v_visibility := 'public';
  elsif p_visibility = 'followers' then
    v_visibility := 'followers';
  elsif p_visibility = 'private' then
    v_visibility := 'private';
  else
    raise exception 'invalid list visibility: %', coalesce(p_visibility, '(null)')
      using errcode = '22023',
            hint = 'visibility must be ''public'', ''followers'', or ''private''';
  end if;

  -- Load and LOCK the caller's OWN list. A missing list, or one owned by
  -- someone else, yields no row and fails safely (RLS independently forbids the
  -- write). The lock serializes concurrent edits to the same list.
  select l.slug into v_slug
  from public.lists l
  where l.id = p_list_id
    and l.user_id = v_uid
  for update;

  if v_slug is null then
    raise exception 'unknown list: %', p_list_id
      using errcode = 'P0002',
            hint = 'no list with that id is owned by the caller';
  end if;

  -- Apply the update. slug is IMMUTABLE and deliberately NOT touched here.
  update public.lists
  set title       = v_title,
      description = v_description,
      is_ranked   = coalesce(p_is_ranked, false),
      visibility  = v_visibility
  where id = p_list_id
    and user_id = v_uid;

  -- Collect the member catalog slugs for cache revalidation.
  select coalesce(array_agg(mi.slug order by li.position), array[]::text[])
  into v_media_slugs
  from public.list_items li
  join public.media_items mi on mi.id = li.media_id
  where li.list_id = p_list_id;

  return jsonb_build_object(
    'list_id',     p_list_id,
    'slug',        v_slug,
    'media_slugs', v_media_slugs
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Follower-aware Row Level Security on lists and list_items
-- ---------------------------------------------------------------------------
drop policy if exists "Public or owned lists are readable" on public.lists;
drop policy if exists "Public, owned, or followed lists are readable" on public.lists;

create policy "Public, owned, or followed lists are readable"
  on public.lists for select
  using (
    visibility = 'public'
    or auth.uid() = user_id
    or (
      visibility = 'followers'
      and auth.uid() is not null
      and exists (
        select 1 from public.follows f
        where f.follower_id = auth.uid()
          and f.following_id = public.lists.user_id
      )
    )
  );

drop policy if exists "List items follow parent list visibility" on public.list_items;

create policy "List items follow parent list visibility"
  on public.list_items for select
  using (
    exists (
      select 1 from public.lists l
      where l.id = list_items.list_id
        and (
          l.visibility = 'public'
          or l.user_id = auth.uid()
          or (
            l.visibility = 'followers'
            and auth.uid() is not null
            and exists (
              select 1 from public.follows f
              where f.follower_id = auth.uid()
                and f.following_id = l.user_id
            )
          )
        )
    )
  );
