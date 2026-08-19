-- Favalog: atomic EDIT and DELETE for a whole list — completing the persistent
-- list ownership lifecycle started by public.create_list / add_list_item /
-- remove_list_item. These follow the EXACT same security model as the existing
-- list RPCs and the diary RPCs.
--
-- SECURITY MODEL — SECURITY INVOKER (identical to the other list RPCs):
--   * Each function runs with the CALLER's identity, so Row Level Security is
--     fully in force for every statement. RLS remains an independent second
--     boundary; these functions are not a privilege-escalation surface.
--   * Ownership is derived internally from auth.uid(); there is NO user_id
--     parameter and no client-supplied ownership, username, slug, owner, or
--     timestamp. A list the caller does not own resolves to no row and fails
--     safely with a clean error that never discloses whether a private list
--     of another owner exists.
--   * Unauthenticated callers are rejected two ways: EXECUTE is revoked from
--     public/anon, and each body raises if auth.uid() is null.
--   * search_path is pinned to '' and every object is schema-qualified.
--   * Each function returns ONLY identifiers/routing data the app needs (list
--     id, the canonical IMMUTABLE slug, and the member media slugs for cache
--     revalidation) — never privileged row data.
--
-- SLUG IMMUTABILITY: update_list NEVER touches lists.slug. Editing a list's
--   title (or anything else) leaves the globally-unique, server-generated slug
--   untouched, so /list/[slug] links stay valid across renames.
--
-- VISIBILITY (this phase): only 'public' and 'private' are accepted, exactly as
--   in create_list. 'followers' (and any other value) is rejected until real
--   follower-aware access exists.
--
-- ORDER PRESERVATION: update_list only ever writes the lists row, never
--   list_items, so toggling is_ranked (or any metadata) preserves the existing
--   deterministic item order and positions unchanged.

-- ---------------------------------------------------------------------------
-- update_list: edit the metadata of a list the caller owns.
--
-- The full desired end-state is supplied (the edit form is pre-filled), so
-- every editable field is authoritative: title, description (NULL/blank clears
-- it), is_ranked, and visibility. The immutable slug is never changed. The
-- lists_set_updated_at trigger refreshes updated_at on the UPDATE.
--
-- Returns { list_id, slug, media_slugs } where media_slugs are the list's
-- member catalog slugs, so the caller can revalidate every /title/[slug] whose
-- add-to-list membership UI would otherwise show a stale list name.
-- ---------------------------------------------------------------------------
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

  -- Only 'public' and 'private' are accepted this phase (as in create_list).
  if p_visibility = 'public' then
    v_visibility := 'public';
  elsif p_visibility = 'private' then
    v_visibility := 'private';
  else
    raise exception 'invalid list visibility: %', coalesce(p_visibility, '(null)')
      using errcode = '22023',
            hint = 'visibility must be ''public'' or ''private''';
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

  -- Apply the metadata changes. The slug is intentionally NOT in the SET list,
  -- so it stays immutable. The BEFORE UPDATE trigger refreshes updated_at.
  update public.lists
  set title       = v_title,
      description = v_description,
      is_ranked   = coalesce(p_is_ranked, false),
      visibility  = v_visibility
  where id = p_list_id;

  -- Collect the member catalog slugs so the app can revalidate those title
  -- pages (their add-to-list membership UI shows this list's name).
  select coalesce(array_agg(mi.slug order by li.position), array[]::text[])
    into v_media_slugs
  from public.list_items li
  join public.media_items mi on mi.id = li.media_id
  where li.list_id = p_list_id;

  return jsonb_build_object(
    'list_id',     p_list_id,
    'slug',        v_slug,
    'media_slugs', to_jsonb(v_media_slugs)
  );
end;
$$;

comment on function public.update_list(uuid, text, text, boolean, text) is
  'Atomically edits the metadata (title, description, is_ranked, visibility) of a list owned by the authenticated caller. SECURITY INVOKER: ownership derives from auth.uid() and RLS applies. The immutable slug is never changed; only ''public''/''private'' visibility is accepted; positions are untouched. Returns { list_id, slug, media_slugs }.';

revoke all on function public.update_list(uuid, text, text, boolean, text) from public;
revoke all on function public.update_list(uuid, text, text, boolean, text) from anon;
grant execute on function public.update_list(uuid, text, text, boolean, text) to authenticated;

-- ---------------------------------------------------------------------------
-- delete_list: delete an entire list the caller owns, with its items.
--
-- FK BEHAVIOR (verified): list_items.list_id references lists(id) ON DELETE
-- CASCADE (see 20260805150500_lists.sql), so removing the list row removes all
-- of its list_items automatically — no orphaned items remain and no explicit
-- child delete is required. We still capture the member slugs BEFORE the delete
-- so the app can revalidate every /title/[slug] whose add-to-list membership UI
-- referenced this now-deleted list.
--
-- Returns { list_id, slug, media_slugs }.
-- ---------------------------------------------------------------------------
create or replace function public.delete_list(
  p_list_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid         uuid := auth.uid();
  v_slug        text;
  v_media_slugs text[];
begin
  if v_uid is null then
    raise exception 'authentication required'
      using errcode = '28000',
            hint = 'delete_list must be called by an authenticated user';
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

  -- Capture member slugs before the cascade removes the items.
  select coalesce(array_agg(mi.slug order by li.position), array[]::text[])
    into v_media_slugs
  from public.list_items li
  join public.media_items mi on mi.id = li.media_id
  where li.list_id = p_list_id;

  -- ON DELETE CASCADE removes every list_items row for this list; no orphan.
  delete from public.lists
  where id = p_list_id
    and user_id = v_uid;

  return jsonb_build_object(
    'list_id',     p_list_id,
    'slug',        v_slug,
    'media_slugs', to_jsonb(v_media_slugs)
  );
end;
$$;

comment on function public.delete_list(uuid) is
  'Atomically deletes an entire list owned by the authenticated caller; list_items are removed by the ON DELETE CASCADE FK (no orphan). SECURITY INVOKER: ownership derives from auth.uid() and RLS applies. Returns { list_id, slug, media_slugs } (member slugs captured before deletion for cache revalidation).';

revoke all on function public.delete_list(uuid) from public;
revoke all on function public.delete_list(uuid) from anon;
grant execute on function public.delete_list(uuid) to authenticated;
