-- Favalog: atomic EDIT and DELETE for a diary entry (and its optional linked
-- review). These complete the persistent diary-entry lifecycle started by
-- public.log_media(...) and follow the exact same security model.
--
-- SECURITY MODEL — SECURITY INVOKER (same as log_media, deliberate):
--   * Each function runs with the CALLER's identity, so Row Level Security is
--     fully in force for every statement. RLS remains an independent second
--     boundary; these functions are not a privilege-escalation surface.
--   * Ownership is derived internally from auth.uid(); there is NO user_id
--     parameter, and every write is scoped to the caller. The target diary
--     entry must already belong to the caller — a non-existent or someone
--     else's id resolves to no row and fails safely with a clean error.
--   * Unauthenticated callers are rejected two ways: EXECUTE is revoked from
--     public/anon (privilege check), and the body raises if auth.uid() is null.
--   * search_path is pinned to '' and every object is schema-qualified, so the
--     functions' behavior cannot be hijacked by a caller-controlled search_path.
--   * Each function returns ONLY the identifiers the application needs (the
--     diary entry id, the linked review id where relevant, and the public
--     catalog slug for cache revalidation) — never privileged or unrelated row
--     data.
--
-- RATING RULES (identical to log_media):
--   * A diary entry may carry a half-star rating in [0.5, 5.0]; validated here
--     for a clean error and enforced again by the diary_entries CHECK. Passing
--     NULL removes an existing rating.
--   * A diary-LINKED review always stores rating = NULL — the diary entry is the
--     single rating source of truth (also enforced by the reviews CHECK).

-- ---------------------------------------------------------------------------
-- update_diary_entry: edit an existing entry and its optional linked review.
--
-- The full desired end-state is supplied (the edit form is pre-filled), so
-- every field is authoritative:
--   * logged date/time, rating (NULL removes it), and revisit flag are applied
--     to the diary entry;
--   * a non-empty review body upserts the linked review (creating one when the
--     entry had none, updating it otherwise);
--   * an empty/blank review body REMOVES the linked review while retaining the
--     diary entry.
-- The diary and linked-review changes happen in ONE transaction (the function
-- body is atomic), so an edit can never half-apply.
-- ---------------------------------------------------------------------------
create or replace function public.update_diary_entry(
  p_diary_entry_id    uuid,
  p_logged_at         timestamptz default null,
  p_rating            numeric     default null,
  p_is_revisit        boolean     default false,
  p_review_title      text        default null,
  p_review_body       text        default null,
  p_contains_spoilers boolean     default false
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid        uuid := auth.uid();
  v_media_id   uuid;
  v_media_slug text;
  v_diary_id   uuid;
  v_review_id  uuid;
  v_title      text := nullif(btrim(coalesce(p_review_title, '')), '');
  v_body       text := nullif(btrim(coalesce(p_review_body, '')), '');
begin
  -- Reject unauthenticated callers (defense in depth alongside the grant).
  if v_uid is null then
    raise exception 'authentication required'
      using errcode = '28000',
            hint = 'update_diary_entry must be called by an authenticated user';
  end if;

  -- Validate the rating up front for a clean, mapped error.
  if p_rating is not null
     and not (p_rating >= 0.5 and p_rating <= 5.0 and (p_rating * 2) = floor(p_rating * 2)) then
    raise exception 'invalid rating: %', p_rating
      using errcode = '22023',
            hint = 'rating must be a half-star value between 0.5 and 5.0';
  end if;

  -- Load and lock the caller's OWN diary entry. Ownership derives from
  -- auth.uid(): an entry that does not exist, or is owned by someone else,
  -- yields no row here (RLS also independently forbids the write).
  select de.id, de.media_id
    into v_diary_id, v_media_id
  from public.diary_entries de
  where de.id = p_diary_entry_id
    and de.user_id = v_uid
  for update;

  if v_diary_id is null then
    raise exception 'unknown diary entry: %', p_diary_entry_id
      using errcode = 'P0002',
            hint = 'no diary entry with that id is owned by the caller';
  end if;

  -- Resolve the public catalog slug for cache revalidation (never privileged).
  select mi.slug into v_media_slug
  from public.media_items mi
  where mi.id = v_media_id;

  -- Apply the diary-entry changes. A NULL logged_at keeps the existing date
  -- (the column is NOT NULL); a NULL rating removes an existing rating.
  update public.diary_entries
  set logged_at  = coalesce(p_logged_at, logged_at),
      rating     = p_rating,
      is_revisit = coalesce(p_is_revisit, false)
  where id = v_diary_id;

  -- Find any existing linked review owned by the caller.
  select r.id into v_review_id
  from public.reviews r
  where r.diary_entry_id = v_diary_id
    and r.user_id = v_uid
  limit 1;

  if v_body is not null then
    -- Upsert the linked review. A linked review's rating is ALWAYS null.
    if v_review_id is not null then
      update public.reviews
      set title             = v_title,
          body              = v_body,
          rating            = null,
          contains_spoilers = coalesce(p_contains_spoilers, false)
      where id = v_review_id;
    else
      insert into public.reviews
        (user_id, media_id, diary_entry_id, title, body, rating, contains_spoilers)
      values
        (v_uid, v_media_id, v_diary_id, v_title, v_body, null, coalesce(p_contains_spoilers, false))
      returning id into v_review_id;
    end if;
  else
    -- The review body was cleared: remove the linked review but keep the entry.
    if v_review_id is not null then
      delete from public.reviews where id = v_review_id;
      v_review_id := null;
    end if;
  end if;

  return jsonb_build_object(
    'diary_entry_id', v_diary_id,
    'review_id',      v_review_id,
    'media_slug',     v_media_slug
  );
end;
$$;

comment on function public.update_diary_entry(uuid, timestamptz, numeric, boolean, text, text, boolean) is
  'Atomically edits the authenticated caller''s own diary entry and its optional linked review (add/update/remove). SECURITY INVOKER: ownership derives from auth.uid() and RLS applies. A linked review always stores rating = NULL; the diary entry owns the rating. Returns only { diary_entry_id, review_id, media_slug }.';

revoke all on function public.update_diary_entry(uuid, timestamptz, numeric, boolean, text, text, boolean) from public;
revoke all on function public.update_diary_entry(uuid, timestamptz, numeric, boolean, text, text, boolean) from anon;
grant execute on function public.update_diary_entry(uuid, timestamptz, numeric, boolean, text, text, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- delete_diary_entry: remove an entry and its linked review atomically.
--
-- The reviews.diary_entry_id foreign key is ON DELETE SET NULL, so deleting the
-- diary entry alone would DETACH (orphan) the review rather than remove it.
-- We therefore delete the caller's linked review(s) explicitly first, then the
-- entry, in one transaction — leaving no orphaned review behind. Deleting the
-- latest log naturally lets the previous log (if any) become the title's latest
-- personal state, because reads resolve the newest remaining entry.
-- ---------------------------------------------------------------------------
create or replace function public.delete_diary_entry(
  p_diary_entry_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid        uuid := auth.uid();
  v_media_id   uuid;
  v_media_slug text;
  v_diary_id   uuid;
begin
  if v_uid is null then
    raise exception 'authentication required'
      using errcode = '28000',
            hint = 'delete_diary_entry must be called by an authenticated user';
  end if;

  -- Load and lock the caller's OWN diary entry. A missing or cross-user id
  -- yields no row and fails safely.
  select de.id, de.media_id
    into v_diary_id, v_media_id
  from public.diary_entries de
  where de.id = p_diary_entry_id
    and de.user_id = v_uid
  for update;

  if v_diary_id is null then
    raise exception 'unknown diary entry: %', p_diary_entry_id
      using errcode = 'P0002',
            hint = 'no diary entry with that id is owned by the caller';
  end if;

  select mi.slug into v_media_slug
  from public.media_items mi
  where mi.id = v_media_id;

  -- Remove the linked review(s) explicitly (FK is SET NULL, not CASCADE), then
  -- the entry itself. Both scoped to the caller.
  delete from public.reviews
  where diary_entry_id = v_diary_id
    and user_id = v_uid;

  delete from public.diary_entries
  where id = v_diary_id
    and user_id = v_uid;

  return jsonb_build_object(
    'diary_entry_id', v_diary_id,
    'media_slug',     v_media_slug
  );
end;
$$;

comment on function public.delete_diary_entry(uuid) is
  'Atomically deletes the authenticated caller''s own diary entry and its linked review (the FK is SET NULL, so the review is removed explicitly — no orphan). SECURITY INVOKER: ownership derives from auth.uid() and RLS applies. Returns only { diary_entry_id, media_slug }.';

revoke all on function public.delete_diary_entry(uuid) from public;
revoke all on function public.delete_diary_entry(uuid) from anon;
grant execute on function public.delete_diary_entry(uuid) to authenticated;
