-- Favalog: atomic "log a title" write path (diary entry + optional review).
--
-- A single narrowly-scoped RPC creates a diary entry and, when a non-empty
-- review body is supplied, its linked review — in ONE transaction (a function
-- body is atomic). The application never issues the two writes separately, so a
-- log can never half-succeed.
--
-- SECURITY MODEL — SECURITY INVOKER (deliberate):
--   * The function runs with the CALLER's identity, so Row Level Security is
--     fully in force for every statement inside it. RLS remains the second
--     security boundary; this function is not a privilege-escalation surface.
--   * Ownership is derived internally from auth.uid(); there is no user_id
--     parameter, so the browser can never assert ownership of another user.
--   * Unauthenticated callers are rejected two ways: EXECUTE is revoked from
--     public/anon (privilege check), and the body raises if auth.uid() is null.
--   * The catalog row is resolved SERVER-SIDE from a trusted slug; the caller
--     never supplies media metadata, only which existing title to log.
--   * search_path is pinned to '' and every object is schema-qualified, so the
--     function's behavior cannot be hijacked by a caller-controlled search_path.
--
-- RATING RULES:
--   * A diary entry may carry a half-star rating in [0.5, 5.0]; validated here
--     for a clean error and enforced again by the diary_entries CHECK.
--   * A diary-LINKED review always stores rating = NULL — the diary entry is the
--     single rating source of truth (also enforced by the reviews CHECK).

create or replace function public.log_media(
  p_media_slug        text,
  p_logged_at         timestamptz default now(),
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
  v_uid       uuid := auth.uid();
  v_media_id  uuid;
  v_diary_id  uuid;
  v_review_id uuid := null;
  v_title     text := nullif(btrim(coalesce(p_review_title, '')), '');
  v_body      text := nullif(btrim(coalesce(p_review_body, '')), '');
begin
  -- Reject unauthenticated callers (defense in depth alongside the grant).
  if v_uid is null then
    raise exception 'authentication required'
      using errcode = '28000',
            hint = 'log_media must be called by an authenticated user';
  end if;

  -- Validate the rating up front for a clean, mapped error.
  if p_rating is not null
     and not (p_rating >= 0.5 and p_rating <= 5.0 and (p_rating * 2) = floor(p_rating * 2)) then
    raise exception 'invalid rating: %', p_rating
      using errcode = '22023',
            hint = 'rating must be a half-star value between 0.5 and 5.0';
  end if;

  -- Resolve the trusted catalog identity server-side (never from the browser).
  select mi.id into v_media_id
  from public.media_items mi
  where mi.slug = p_media_slug;

  if v_media_id is null then
    raise exception 'unknown media slug: %', p_media_slug
      using errcode = 'P0002',
            hint = 'no catalog title matches the provided slug';
  end if;

  -- Insert the diary entry (RLS with-check binds user_id to auth.uid()).
  insert into public.diary_entries (user_id, media_id, logged_at, rating, is_revisit)
  values (v_uid, v_media_id, coalesce(p_logged_at, now()), p_rating, coalesce(p_is_revisit, false))
  returning id into v_diary_id;

  -- Insert the linked review only when a non-empty body is supplied. A linked
  -- review's rating is ALWAYS null — the diary entry owns the rating.
  if v_body is not null then
    insert into public.reviews
      (user_id, media_id, diary_entry_id, title, body, rating, contains_spoilers)
    values
      (v_uid, v_media_id, v_diary_id, v_title, v_body, null, coalesce(p_contains_spoilers, false))
    returning id into v_review_id;
  end if;

  return jsonb_build_object(
    'diary_entry_id', v_diary_id,
    'review_id',      v_review_id,
    'media_id',       v_media_id
  );
end;
$$;

comment on function public.log_media(text, timestamptz, numeric, boolean, text, text, boolean) is
  'Atomically creates a diary entry (and an optional diary-linked review) for the authenticated caller. SECURITY INVOKER: ownership derives from auth.uid() and RLS applies. The media is resolved server-side from a trusted slug; a linked review always stores rating = NULL.';

-- Execution privileges: only authenticated users may log. Revoke the implicit
-- PUBLIC grant (which would include anon) and grant EXECUTE to authenticated.
revoke all on function public.log_media(text, timestamptz, numeric, boolean, text, text, boolean) from public;
revoke all on function public.log_media(text, timestamptz, numeric, boolean, text, text, boolean) from anon;
grant execute on function public.log_media(text, timestamptz, numeric, boolean, text, text, boolean) to authenticated;
