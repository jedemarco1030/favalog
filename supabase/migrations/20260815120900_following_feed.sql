-- Favalog: Phase 4B.2 — Following feed.
--
-- A single narrow read RPC, `public.get_following_feed(...)`, returns one
-- bounded, correctly ordered, deduplicated page of the real entertainment
-- activity of the accounts the authenticated viewer currently follows.
--
-- DERIVATION, NOT DENORMALIZATION:
--   The feed is derived at read time from the authoritative records that
--   already exist (`public.diary_entries`, `public.reviews`, `public.follows`).
--   There is no event store, no fan-out-on-write, and no snapshot of user
--   content — so edits and deletes propagate for free and no stale excerpt can
--   ever be retained.
--
-- SECURITY MODEL — SECURITY INVOKER:
--   * Runs with the caller's identity, with RLS on every source table in force.
--     Every source table is already public-read, so no privilege elevation is
--     needed: following is an *additional selection condition*, never a bypass.
--   * search_path is pinned to '' and every reference is schema-qualified.
--   * EXECUTE is revoked from public/anon and granted only to authenticated.
--   * Viewer identity comes exclusively from auth.uid(). There is deliberately
--     NO caller-supplied viewer id parameter; a null uid is rejected (28000).
--   * Only public identity, canonical media references, and authorized activity
--     fields are returned — never auth metadata, emails, or private list data.
--
-- ACTIVITY UNIT AND DEDUPLICATION:
--   The diary entry is the activity unit. A review linked to a diary entry is
--   embedded into that diary row, so a log + rating + review is exactly ONE
--   item. Only a standalone review (`diary_entry_id is null`) becomes its own
--   item. Dedup happens in SQL, so pagination boundaries cannot defeat it.
--
-- ORDERING AND PAGINATION:
--   Total order is (created_at desc, source_rank asc, id desc) where
--   source_rank is diary = 0, review = 1. That triple is unique and stable even
--   when timestamps are identical across source types. `created_at` is
--   immutable (the set_updated_at trigger touches only `updated_at`), so
--   editing an entry never bumps its feed position. Pagination is a
--   row-comparison keyset seek; eligibility and ordering are applied BEFORE the
--   limit, and the limit is clamped server-side.

-- ---------------------------------------------------------------------------
-- 1. Supporting indexes
-- ---------------------------------------------------------------------------
-- The feed reads per followed author in the exact total order above. The
-- pre-existing indexes key on the WRONG column for this query:
-- diary_entries (user_id, logged_at desc) orders by the user-selected diary
-- date, and reviews (user_id, created_at desc) also covers linked reviews the
-- standalone arm must skip.
--
-- Evidence — local EXPLAIN (ANALYZE, BUFFERS) on a seeded fixture of 10 050
-- diary entries and ~3 200 reviews across 201 actors, viewer following 30:
-- with these two indexes present the planner chooses BOTH of them
-- (Bitmap Index Scan on diary_entries_user_id_created_at_id_idx, Index Scan on
-- reviews_standalone_user_id_created_at_id_idx); with them dropped it falls
-- back to the logged_at / non-partial indexes. They also carry the created_at
-- predicate of the keyset seek, which the logged_at index cannot. The reviews
-- index is partial because the standalone arm is the only one that reads
-- reviews directly.
create index if not exists diary_entries_user_id_created_at_id_idx
  on public.diary_entries (user_id, created_at desc, id desc);

create index if not exists reviews_standalone_user_id_created_at_id_idx
  on public.reviews (user_id, created_at desc, id desc)
  where diary_entry_id is null;

-- ---------------------------------------------------------------------------
-- 2. public.get_following_feed RPC
-- ---------------------------------------------------------------------------
create or replace function public.get_following_feed(
  p_limit             int         default 20,
  p_cursor_created_at timestamptz default null,
  p_cursor_source     text        default null,
  p_cursor_id         uuid        default null
)
returns table (
  source             text,
  activity_id        uuid,
  created_at         timestamptz,
  logged_at          timestamptz,
  actor_username     text,
  actor_display_name text,
  actor_avatar_url   text,
  media_slug         text,
  media_title        text,
  media_year         int,
  media_kind         text,
  media_poster_url   text,
  rating             numeric(2, 1),
  is_revisit         boolean,
  review_id          uuid,
  review_title       text,
  review_body        text,
  contains_spoilers  boolean
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_uid          uuid := auth.uid();
  v_limit        int;
  v_cursor_rank  int;
  v_cursor_parts int;
begin
  if v_uid is null then
    raise exception 'authentication required'
      using errcode = '28000',
            hint = 'get_following_feed must be called by an authenticated user';
  end if;

  -- Bounded page size. A null/absurd limit is clamped, never trusted.
  v_limit := least(greatest(coalesce(p_limit, 20), 1), 50);

  -- The cursor is a position, never an authorization. It is all-or-nothing:
  -- a partial cursor is a malformed request.
  v_cursor_parts :=
      (case when p_cursor_created_at is null then 0 else 1 end)
    + (case when p_cursor_source is null then 0 else 1 end)
    + (case when p_cursor_id is null then 0 else 1 end);

  if v_cursor_parts not in (0, 3) then
    raise exception 'invalid feed cursor'
      using errcode = '22023',
            hint = 'cursor requires created_at, source, and id together';
  end if;

  if p_cursor_source is not null then
    v_cursor_rank := case p_cursor_source
      when 'diary' then 0
      when 'review' then 1
      else null
    end;

    if v_cursor_rank is null then
      raise exception 'invalid feed cursor source: %', p_cursor_source
        using errcode = '22023',
              hint = 'cursor source must be ''diary'' or ''review''';
    end if;
  end if;

  return query
  with candidates as (
    -- Diary arm: the activity unit. Its linked review (if any) is embedded, so
    -- a log + rating + review renders as exactly one combined item.
    select
      'diary'::text                     as c_source,
      0                                 as c_source_rank,
      de.id                             as c_activity_id,
      de.created_at                     as c_created_at,
      de.logged_at                      as c_logged_at,
      pr.username::text                 as c_actor_username,
      pr.display_name                   as c_actor_display_name,
      pr.avatar_url                     as c_actor_avatar_url,
      mi.slug                           as c_media_slug,
      mi.title                          as c_media_title,
      mi.year                           as c_media_year,
      mi.kind::text                     as c_media_kind,
      mi.poster_url                     as c_media_poster_url,
      de.rating                         as c_rating,
      de.is_revisit                     as c_is_revisit,
      lr.id                             as c_review_id,
      lr.title                          as c_review_title,
      left(lr.body, 600)                as c_review_body,
      lr.contains_spoilers              as c_contains_spoilers
    from public.diary_entries de
      join public.profiles pr on pr.id = de.user_id
      join public.media_items mi on mi.id = de.media_id
      left join lateral (
        select r.id, r.title, r.body, r.contains_spoilers
        from public.reviews r
        where r.diary_entry_id = de.id
        order by r.created_at asc, r.id asc
        limit 1
      ) lr on true
    where de.user_id <> v_uid
      and exists (
        select 1
        from public.follows f
        where f.follower_id = v_uid
          and f.following_id = de.user_id
      )

    union all

    -- Standalone-review arm: an independent persistent record with no diary
    -- entry of its own (including a review whose entry was later deleted,
    -- because reviews.diary_entry_id is ON DELETE SET NULL).
    select
      'review'::text                    as c_source,
      1                                 as c_source_rank,
      rv.id                             as c_activity_id,
      rv.created_at                     as c_created_at,
      null::timestamptz                 as c_logged_at,
      pr.username::text                 as c_actor_username,
      pr.display_name                   as c_actor_display_name,
      pr.avatar_url                     as c_actor_avatar_url,
      mi.slug                           as c_media_slug,
      mi.title                          as c_media_title,
      mi.year                           as c_media_year,
      mi.kind::text                     as c_media_kind,
      mi.poster_url                     as c_media_poster_url,
      rv.rating                         as c_rating,
      false                             as c_is_revisit,
      rv.id                             as c_review_id,
      rv.title                          as c_review_title,
      left(rv.body, 600)                as c_review_body,
      rv.contains_spoilers              as c_contains_spoilers
    from public.reviews rv
      join public.profiles pr on pr.id = rv.user_id
      join public.media_items mi on mi.id = rv.media_id
    where rv.diary_entry_id is null
      and rv.user_id <> v_uid
      and exists (
        select 1
        from public.follows f
        where f.follower_id = v_uid
          and f.following_id = rv.user_id
      )
  )
  select
    c.c_source,
    c.c_activity_id,
    c.c_created_at,
    c.c_logged_at,
    c.c_actor_username,
    c.c_actor_display_name,
    c.c_actor_avatar_url,
    c.c_media_slug,
    c.c_media_title,
    c.c_media_year,
    c.c_media_kind,
    c.c_media_poster_url,
    c.c_rating,
    c.c_is_revisit,
    c.c_review_id,
    c.c_review_title,
    c.c_review_body,
    c.c_contains_spoilers
  from candidates c
  where p_cursor_created_at is null
     or (
       -- Keyset seek on the unique total order. source_rank is negated so the
       -- whole row comparison is strictly descending, which is exactly
       -- (created_at desc, source_rank asc, id desc).
       (c.c_created_at, -c.c_source_rank, c.c_activity_id)
         < (p_cursor_created_at, -v_cursor_rank, p_cursor_id)
     )
  order by c.c_created_at desc, c.c_source_rank asc, c.c_activity_id desc
  limit v_limit;
end;
$$;

comment on function public.get_following_feed(int, timestamptz, text, uuid) is
  'Returns one bounded page of the authenticated viewer''s following feed, derived from public.diary_entries, public.reviews, and public.follows. SECURITY INVOKER with pinned empty search_path; viewer identity comes only from auth.uid() (no caller-supplied viewer id). A diary entry embeds its linked review so a combined action is one row; only standalone reviews form their own rows. Total order (created_at desc, source_rank asc, id desc) with a row-comparison keyset seek and a server-clamped limit.';

revoke all on function public.get_following_feed(int, timestamptz, text, uuid) from public;
revoke all on function public.get_following_feed(int, timestamptz, text, uuid) from anon;
grant execute on function public.get_following_feed(int, timestamptz, text, uuid) to authenticated;
