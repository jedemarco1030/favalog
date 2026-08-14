-- Favalog: atomic, narrowly-scoped write paths for the first persistent list
-- loop — create a list, add a title, remove a title.
--
-- SECURITY MODEL — SECURITY INVOKER (identical to log_media / *_diary_entry):
--   * Each function runs with the CALLER's identity, so Row Level Security is
--     fully in force for every statement. RLS remains an independent second
--     boundary; these functions are not a privilege-escalation surface.
--   * Ownership is derived internally from auth.uid(); there is NO user_id
--     parameter and no client-supplied ownership. A list the caller does not
--     own resolves to no row and fails safely with a clean error.
--   * Unauthenticated callers are rejected two ways: EXECUTE is revoked from
--     public/anon, and each body raises if auth.uid() is null.
--   * search_path is pinned to '' and every object is schema-qualified.
--   * Catalog identity is resolved SERVER-SIDE from a trusted slug; the caller
--     never supplies media metadata, only which existing title is involved.
--   * Each function returns ONLY identifiers/routing data the app needs (list
--     id, canonical slug, media id, position) — never privileged row data.
--
-- VISIBILITY (this phase): only 'public' and 'private' are accepted. The DB
--   enum also carries 'followers', which is deliberately NOT exposed until real
--   follower-aware access exists. The domain ListVisibility 'unlisted' has no
--   database representation and is likewise not accepted.
--
-- POSITIONS: list_items.position is a zero-based, contiguous, deterministic
--   order. Adds append at the next position under a per-list row lock so
--   concurrent adds cannot collide; removes compact the remaining positions.

-- ---------------------------------------------------------------------------
-- create_list: create a list owned by the caller, with a server-generated,
-- globally-unique, immutable slug. Optionally add one trusted catalog title in
-- the SAME transaction (so "create list from the title dialog" is atomic).
--
-- Returns { list_id, slug, added_media_slug } where added_media_slug is the
-- slug that was added (or null when none / already implied by creation).
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

  -- Only 'public' and 'private' are accepted this phase. 'followers' and any
  -- other value (including the domain-only 'unlisted') are rejected.
  if p_visibility = 'public' then
    v_visibility := 'public';
  elsif p_visibility = 'private' then
    v_visibility := 'private';
  else
    raise exception 'invalid list visibility: %', coalesce(p_visibility, '(null)')
      using errcode = '22023',
            hint = 'visibility must be ''public'' or ''private''';
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
    exception when unique_violation then
      v_suffix := v_suffix + 1;
      if v_suffix > 1000 then
        raise exception 'could not generate a unique list slug'
          using errcode = '55000';
      end if;
      v_slug := v_base || '-' || v_suffix;
    end;
  end loop;

  -- Optionally add one trusted catalog title at position 0, atomically.
  if nullif(btrim(coalesce(p_media_slug, '')), '') is not null then
    select mi.id, mi.slug into v_media_id, v_added_slug
    from public.media_items mi
    where mi.slug = btrim(p_media_slug);

    if v_media_id is null then
      raise exception 'unknown media slug: %', p_media_slug
        using errcode = 'P0002',
              hint = 'no catalog title matches the provided slug';
    end if;

    insert into public.list_items (list_id, media_id, position)
    values (v_list_id, v_media_id, 0);
    -- created_at/updated_at already reflect creation; no touch needed.
  end if;

  return jsonb_build_object(
    'list_id',          v_list_id,
    'slug',             v_slug,
    'added_media_slug', v_added_slug
  );
end;
$$;

comment on function public.create_list(text, text, boolean, text, text) is
  'Atomically creates a list owned by the authenticated caller with a server-generated, globally-unique, immutable slug, optionally adding one trusted catalog title. SECURITY INVOKER: ownership derives from auth.uid() and RLS applies. Only ''public''/''private'' visibility is accepted. Returns { list_id, slug, added_media_slug }.';

revoke all on function public.create_list(text, text, boolean, text, text) from public;
revoke all on function public.create_list(text, text, boolean, text, text) from anon;
grant execute on function public.create_list(text, text, boolean, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- add_list_item: append a trusted catalog title to a list the caller owns.
--
-- Idempotent: adding a title already present returns { already_present: true }
-- with its existing position rather than duplicating it or leaking a raw
-- unique-constraint error. Appends at the next zero-based position under a
-- per-list row lock so concurrent adds cannot create duplicate positions, and
-- bumps the parent list's updated_at.
--
-- Returns { list_id, slug, media_id, position, already_present }.
-- ---------------------------------------------------------------------------
create or replace function public.add_list_item(
  p_list_id    uuid,
  p_media_slug text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid          uuid := auth.uid();
  v_slug         text;
  v_media_id     uuid;
  v_position     int;
  v_existing_pos int;
begin
  if v_uid is null then
    raise exception 'authentication required'
      using errcode = '28000',
            hint = 'add_list_item must be called by an authenticated user';
  end if;

  -- Load and LOCK the caller's OWN list. A missing list, or one owned by
  -- someone else, yields no row and fails safely (RLS independently forbids the
  -- write). The lock serializes concurrent adds to the same list.
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

  -- Resolve the trusted catalog identity server-side (never from the browser).
  select mi.id into v_media_id
  from public.media_items mi
  where mi.slug = btrim(coalesce(p_media_slug, ''));

  if v_media_id is null then
    raise exception 'unknown media slug: %', p_media_slug
      using errcode = 'P0002',
            hint = 'no catalog title matches the provided slug';
  end if;

  -- Idempotent add: if the title is already in the list, report it safely.
  select li.position into v_existing_pos
  from public.list_items li
  where li.list_id = p_list_id
    and li.media_id = v_media_id;

  if v_existing_pos is not null then
    return jsonb_build_object(
      'list_id',         p_list_id,
      'slug',            v_slug,
      'media_id',        v_media_id,
      'position',        v_existing_pos,
      'already_present', true
    );
  end if;

  -- Append at the next contiguous zero-based position.
  select coalesce(max(li.position) + 1, 0) into v_position
  from public.list_items li
  where li.list_id = p_list_id;

  insert into public.list_items (list_id, media_id, position)
  values (p_list_id, v_media_id, v_position);

  -- Bump the parent list's updated_at (the trigger forces now()).
  update public.lists set updated_at = now() where id = p_list_id;

  return jsonb_build_object(
    'list_id',         p_list_id,
    'slug',            v_slug,
    'media_id',        v_media_id,
    'position',        v_position,
    'already_present', false
  );
end;
$$;

comment on function public.add_list_item(uuid, text) is
  'Appends a trusted catalog title to a list owned by the authenticated caller, idempotently. SECURITY INVOKER: ownership from auth.uid(), RLS applies. Locks the list to serialize concurrent adds; bumps the list updated_at. Returns { list_id, slug, media_id, position, already_present }.';

revoke all on function public.add_list_item(uuid, text) from public;
revoke all on function public.add_list_item(uuid, text) from anon;
grant execute on function public.add_list_item(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- remove_list_item: remove a title from a list the caller owns, then compact
-- the remaining positions so they stay contiguous (0..n-1) and deterministic.
--
-- Idempotent: removing a title that is not present returns { removed: false }
-- rather than failing. Bumps the parent list's updated_at when a row is
-- removed.
--
-- Returns { list_id, slug, media_id, removed }.
-- ---------------------------------------------------------------------------
create or replace function public.remove_list_item(
  p_list_id    uuid,
  p_media_slug text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid       uuid := auth.uid();
  v_slug      text;
  v_media_id  uuid;
  v_deleted   int;
  v_offset    int;
begin
  if v_uid is null then
    raise exception 'authentication required'
      using errcode = '28000',
            hint = 'remove_list_item must be called by an authenticated user';
  end if;

  -- Load and LOCK the caller's OWN list (fails safely for missing/cross-user).
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

  -- Resolve the trusted catalog identity server-side.
  select mi.id into v_media_id
  from public.media_items mi
  where mi.slug = btrim(coalesce(p_media_slug, ''));

  if v_media_id is null then
    raise exception 'unknown media slug: %', p_media_slug
      using errcode = 'P0002',
            hint = 'no catalog title matches the provided slug';
  end if;

  delete from public.list_items
  where list_id = p_list_id
    and media_id = v_media_id;
  get diagnostics v_deleted = row_count;

  -- Idempotent: the title was not present -> nothing to compact or touch.
  if v_deleted = 0 then
    return jsonb_build_object(
      'list_id',  p_list_id,
      'slug',     v_slug,
      'media_id', v_media_id,
      'removed',  false
    );
  end if;

  -- Compact remaining positions to a contiguous 0..n-1 range. Parking the rows
  -- at a temporary offset above the current maximum keeps every intermediate
  -- value non-negative (list_items_position_non_negative) while remaining
  -- disjoint from both the old and the new ranges, so no ordering of row
  -- updates can produce a transient duplicate on (list_id, position).
  select coalesce(max(li.position), 0) + 1 into v_offset
  from public.list_items li
  where li.list_id = p_list_id;

  update public.list_items
  set position = position + v_offset
  where list_id = p_list_id;

  with ordered as (
    select li.id,
           (row_number() over (order by li.position)) - 1 as new_pos
    from public.list_items li
    where li.list_id = p_list_id
  )
  update public.list_items li
  set position = o.new_pos
  from ordered o
  where li.id = o.id;

  update public.lists set updated_at = now() where id = p_list_id;

  return jsonb_build_object(
    'list_id',  p_list_id,
    'slug',     v_slug,
    'media_id', v_media_id,
    'removed',  true
  );
end;
$$;

comment on function public.remove_list_item(uuid, text) is
  'Removes a title from a list owned by the authenticated caller, then compacts remaining positions to a contiguous 0..n-1 range. Idempotent when absent. SECURITY INVOKER: ownership from auth.uid(), RLS applies. Bumps updated_at on removal. Returns { list_id, slug, media_id, removed }.';

revoke all on function public.remove_list_item(uuid, text) from public;
revoke all on function public.remove_list_item(uuid, text) from anon;
grant execute on function public.remove_list_item(uuid, text) to authenticated;
