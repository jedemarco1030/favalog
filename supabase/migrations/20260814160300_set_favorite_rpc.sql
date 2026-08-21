-- Favalog: the persistent favorites loop — one atomic, idempotent write path
-- for marking a title as a favorite or removing it. This completes the
-- publicly-readable, owner-writable favorites shelf whose table + RLS were laid
-- down in 20260805150600_favorites_follows.sql and 20260805150700.
--
-- SECURITY MODEL — SECURITY INVOKER (identical to log_media / the list RPCs):
--   * The function runs with the CALLER's identity, so Row Level Security is
--     fully in force for every statement. RLS remains an independent second
--     boundary; this function is not a privilege-escalation surface.
--   * Ownership is derived internally from auth.uid(); there is NO user_id,
--     media_id, username, position, or ownership parameter. The browser only
--     says WHICH title (by trusted slug) and the DESIRED state (a boolean).
--   * Unauthenticated callers are rejected two ways: EXECUTE is revoked from
--     public/anon, and the body raises if auth.uid() is null.
--   * search_path is pinned to '' and every object is schema-qualified.
--   * Catalog identity is resolved SERVER-SIDE from a trusted slug; the caller
--     never supplies a media UUID or any media metadata.
--   * The function returns ONLY identifiers + the actual resulting state the
--     app needs (favorite id when present, media id, canonical slug, resulting
--     position when present, is_favorite, and whether a row changed) — never
--     profile details or other privileged data.
--
-- POSITIONS: favorites.position is a per-user, zero-based, contiguous,
--   deterministic order. A new favorite appends at the next position; removing
--   one compacts the remaining positions back to 0..n-1. The two unique indexes
--   (user_id, media_id) and (user_id, position) guarantee "at most once per
--   title" and a gap-free ordering respectively.
--
-- SERIALIZATION: every position-changing branch first locks the caller's OWN
--   profiles row (SELECT ... FOR UPDATE). This serializes concurrent favorite
--   writes for a single user so two simultaneous appends can't claim the same
--   position and a concurrent add+remove can't corrupt the compaction — while
--   never blocking a different user. The profile row always exists (created by
--   the auth trigger) even before the user's first favorite, so it is a stable
--   lock target for the very first append.

-- ---------------------------------------------------------------------------
-- set_favorite: idempotently add or remove the caller's favorite for a title.
--
-- p_is_favorite = true  -> ensure the title is a favorite (append if absent;
--                          a no-op success if already present, never a dupe).
-- p_is_favorite = false -> ensure the title is NOT a favorite (remove if
--                          present and compact positions; a no-op success if
--                          already absent).
--
-- Returns { favorite_id, media_id, slug, position, is_favorite, changed }.
-- `favorite_id` and `position` are null when the resulting state is "not a
-- favorite"; `changed` is true only when a row was actually inserted/deleted.
-- ---------------------------------------------------------------------------
create or replace function public.set_favorite(
  p_media_slug  text,
  p_is_favorite boolean
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid          uuid := auth.uid();
  v_media_id     uuid;
  v_slug         text;
  v_fav_id       uuid;
  v_position     int;
  v_existing_pos int;
  v_deleted      int;
  v_offset       int;
begin
  if v_uid is null then
    raise exception 'authentication required'
      using errcode = '28000',
            hint = 'set_favorite must be called by an authenticated user';
  end if;

  -- The desired state must be an explicit boolean; null is rejected.
  if p_is_favorite is null then
    raise exception 'invalid favorite state'
      using errcode = '22023',
            hint = 'is_favorite must be true or false';
  end if;

  -- Resolve the trusted catalog identity server-side (never from the browser).
  select mi.id, mi.slug into v_media_id, v_slug
  from public.media_items mi
  where mi.slug = btrim(coalesce(p_media_slug, ''));

  if v_media_id is null then
    raise exception 'unknown media slug: %', p_media_slug
      using errcode = 'P0002',
            hint = 'no catalog title matches the provided slug';
  end if;

  -- Serialize this user's position-changing favorite writes by locking their
  -- OWN profile row. RLS (SECURITY INVOKER) only ever lets the caller see/lock
  -- their own identity here; a different user is never blocked.
  perform 1 from public.profiles p where p.id = v_uid for update;

  if p_is_favorite then
    -- Idempotent add: if the title is already a favorite, report it unchanged.
    select f.id, f.position into v_fav_id, v_existing_pos
    from public.favorites f
    where f.user_id = v_uid
      and f.media_id = v_media_id;

    if v_fav_id is not null then
      return jsonb_build_object(
        'favorite_id', v_fav_id,
        'media_id',    v_media_id,
        'slug',        v_slug,
        'position',    v_existing_pos,
        'is_favorite', true,
        'changed',     false
      );
    end if;

    -- Append at the next contiguous zero-based position for this user.
    select coalesce(max(f.position) + 1, 0) into v_position
    from public.favorites f
    where f.user_id = v_uid;

    insert into public.favorites (user_id, media_id, position)
    values (v_uid, v_media_id, v_position)
    returning id into v_fav_id;

    return jsonb_build_object(
      'favorite_id', v_fav_id,
      'media_id',    v_media_id,
      'slug',        v_slug,
      'position',    v_position,
      'is_favorite', true,
      'changed',     true
    );
  else
    -- Remove the favorite if present.
    delete from public.favorites
    where user_id = v_uid
      and media_id = v_media_id;
    get diagnostics v_deleted = row_count;

    -- Idempotent remove: the title was not a favorite -> nothing to compact.
    if v_deleted = 0 then
      return jsonb_build_object(
        'favorite_id', null,
        'media_id',    v_media_id,
        'slug',        v_slug,
        'position',    null,
        'is_favorite', false,
        'changed',     false
      );
    end if;

    -- Compact remaining positions to a contiguous 0..n-1 range. Parking every
    -- row at a temporary offset above the current maximum keeps every
    -- intermediate value non-negative (favorites_position_non_negative) while
    -- staying disjoint from both the old and the new ranges, so no ordering of
    -- row updates can produce a transient duplicate on (user_id, position).
    select coalesce(max(f.position), 0) + 1 into v_offset
    from public.favorites f
    where f.user_id = v_uid;

    update public.favorites
    set position = position + v_offset
    where user_id = v_uid;

    with ordered as (
      select f.id,
             (row_number() over (order by f.position)) - 1 as new_pos
      from public.favorites f
      where f.user_id = v_uid
    )
    update public.favorites f
    set position = o.new_pos
    from ordered o
    where f.id = o.id;

    return jsonb_build_object(
      'favorite_id', null,
      'media_id',    v_media_id,
      'slug',        v_slug,
      'position',    null,
      'is_favorite', false,
      'changed',     true
    );
  end if;
end;
$$;

comment on function public.set_favorite(text, boolean) is
  'Atomically and idempotently adds or removes the authenticated caller''s favorite for a trusted catalog title. SECURITY INVOKER: ownership derives from auth.uid() and RLS applies. Appends at the next zero-based position; removal compacts positions to a contiguous 0..n-1 range. Locks the caller''s profile row to serialize concurrent favorite writes. Returns { favorite_id, media_id, slug, position, is_favorite, changed }.';

revoke all on function public.set_favorite(text, boolean) from public;
revoke all on function public.set_favorite(text, boolean) from anon;
grant execute on function public.set_favorite(text, boolean) to authenticated;
