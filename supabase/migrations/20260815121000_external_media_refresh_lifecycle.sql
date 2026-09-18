-- Favalog Catalog Platform: bounded provider-metadata REFRESH lifecycle for
-- ALREADY-MATERIALIZED provider-owned records (forward-only).
--
-- SCOPE. The materialization path (materialize_media_item / materialize_external_media)
-- IMPORTS a provider result into a canonical public.media_items row. This
-- migration adds the distinct REFRESH lifecycle a periodic operator process
-- uses to keep those already-imported provider rows current, and to react when
-- the provider record changes or disappears — WITHOUT ever re-importing,
-- re-slugging, or creating rows. It intentionally does NOT enable TMDB in
-- production or schedule any writes; it is the database foundation those later
-- increments build on. The refresh functions are provider-neutral (tmdb /
-- openlibrary) but the first consumer is the TMDB refresh worker.
--
-- WHAT IT ADDS.
--   1. Freshness + lifecycle bookkeeping columns on public.media_items:
--        * provider_checked_at   — last time a provider check SUCCEEDED, whether
--          or not the content changed (freshness, distinct from content change);
--        * provider_removed_at   — set when the provider CONFIRMED the record is
--          gone (soft removal). Null = present/exposed;
--        * refresh_failure_count — consecutive TRANSIENT failures since the last
--          success (a transient failure never removes/hides content);
--        * last_refresh_error / last_refresh_error_at — the last transient
--          failure reason + when, for operator observability.
--   2. Three NARROW, service_role-only operator RPCs (SECURITY INVOKER, pinned
--      empty search_path, fully schema-qualified, EXECUTE revoked from
--      public/anon/authenticated so a browser role can NEVER invoke them):
--        * refresh_external_media(...)             — apply a SUCCESSFUL provider
--          fetch (changed or unchanged) with optimistic-concurrency protection;
--        * mark_external_media_refresh_failed(...) — record a TRANSIENT failure
--          (never removes, never touches content);
--        * mark_external_media_removed(...)        — record a CONFIRMED removal
--          (soft-hide; never deletes the media row, its aliases, or ANY
--          user-owned rows).
--   3. Removal-aware retrieval: the public search functions stop exposing a
--      soft-removed provider row while every user reference to it survives.
--
-- INVARIANTS (enforced by the functions + the pgTAP suite):
--   * Media id, immutable slug, media_external_ids aliases, and every user-owned
--     row (diary entries, reviews, favorites, list memberships) are preserved by
--     every refresh/removal/failure outcome.
--   * Curated source='favalog' rows are NEVER overwritten, removed, or marked
--     failed by any of these operator RPCs (curated protection), even when a
--     provider identity is aliased to a curated row.
--   * A successful freshness check advances provider_checked_at ONLY; a genuine
--     content change ALSO advances content_hash / normalization_version /
--     synced_at and the normalized fields, so provenance and stored metadata
--     always agree.
--   * A stale concurrent writer (its baseline content hash no longer matches the
--     stored hash) is REJECTED rather than clobbering a newer write.
--   * A transient failure is distinguished from a confirmed removal: only the
--     latter hides content; the former only increments the failure counter.

-- ---------------------------------------------------------------------------
-- 1. Freshness + lifecycle bookkeeping columns.
--
-- All nullable / defaulted so existing curated and provider rows remain valid
-- and untouched; curated rows simply never receive provider bookkeeping.
-- ---------------------------------------------------------------------------
alter table public.media_items
  add column if not exists provider_checked_at   timestamptz,
  add column if not exists provider_removed_at   timestamptz,
  add column if not exists refresh_failure_count integer not null default 0,
  add column if not exists last_refresh_error    text,
  add column if not exists last_refresh_error_at timestamptz;

alter table public.media_items
  drop constraint if exists media_items_refresh_failure_count_nonneg;
alter table public.media_items
  add constraint media_items_refresh_failure_count_nonneg
    check (refresh_failure_count >= 0);

alter table public.media_items
  drop constraint if exists media_items_last_refresh_error_length;
alter table public.media_items
  add constraint media_items_last_refresh_error_length
    check (last_refresh_error is null or char_length(last_refresh_error) <= 500);

comment on column public.media_items.provider_checked_at is
  'Timestamp of the last SUCCESSFUL provider freshness check (whether or not the content changed). Null for curated rows and provider rows never yet refreshed. Distinct from synced_at, which advances only on an actual content change.';
comment on column public.media_items.provider_removed_at is
  'Set when the provider CONFIRMED this record is gone (soft removal). Null = present/exposed. A soft-removed row is hidden from public discovery but is never deleted, so user references survive; a later successful refresh clears it (resurrection).';
comment on column public.media_items.refresh_failure_count is
  'Consecutive TRANSIENT provider-refresh failures since the last success. A transient failure never removes or hides content; a successful refresh or confirmed removal resets it to 0.';
comment on column public.media_items.last_refresh_error is
  'Short reason for the most recent TRANSIENT provider-refresh failure (operator observability). Null once a refresh succeeds.';
comment on column public.media_items.last_refresh_error_at is
  'Timestamp of the most recent TRANSIENT provider-refresh failure. Null once a refresh succeeds.';

-- Selection support for the bounded periodic refresh worker: find provider-owned
-- rows ordered by how long ago they were checked (nulls first = never checked).
-- The predicate is a constant, so the partial index is IMMUTABLE and valid.
create index if not exists media_items_provider_refresh_idx
  on public.media_items (source, provider_checked_at nulls first)
  where source <> 'favalog';

-- ---------------------------------------------------------------------------
-- 2a. refresh_external_media: apply a SUCCESSFUL provider fetch.
--
-- The caller (the trusted server, after independently re-fetching + normalizing
-- the provider detail) supplies the normalized product plus the baseline content
-- hash it last observed (p_expected_content_hash) for optimistic concurrency.
-- Resolves an EXISTING provider identity (alias, then direct source/external_id)
-- to its canonical row; it NEVER creates, links, or re-slugs. Behaviour:
--   * unknown identity                 -> P0002 (refresh does not import);
--   * curated (favalog) resolved row   -> P0004 (curated protection);
--   * expected hash set + mismatch     -> P0005 (stale concurrent write rejected);
--   * new hash / version, OR the row was soft-removed (resurrection)
--       -> CHANGED: full refresh of provider-controlled fields together with
--          content_hash / normalization_version / synced_at, clearing removal +
--          failure state and stamping provider_checked_at;
--   * otherwise
--       -> UNCHANGED: a successful freshness check that stamps provider_checked_at
--          (and clears failure state) ONLY, leaving content + synced_at intact.
-- ---------------------------------------------------------------------------
create or replace function public.refresh_external_media(
  p_source                text,
  p_kind                  public.media_kind,
  p_external_id           text,
  p_title                 text,
  p_subtitle              text,
  p_synopsis              text,
  p_year                  integer,
  p_poster_url            text,
  p_backdrop_url          text,
  p_average_rating        numeric,
  p_genres                text[],
  p_details               jsonb,
  p_content_hash          text,
  p_normalization_version text,
  p_expected_content_hash text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_source         text := btrim(coalesce(p_source, ''));
  v_ext            text := btrim(coalesce(p_external_id, ''));
  v_title          text := btrim(coalesce(p_title, ''));
  v_version        text := nullif(btrim(coalesce(p_normalization_version, '')), '');
  v_expected       text := nullif(btrim(coalesce(p_expected_content_hash, '')), '');
  v_synced         timestamptz := now();
  v_media_id       uuid;
  v_row_source     text;
  v_stored_hash    text;
  v_stored_version text;
  v_removed        timestamptz;
  v_slug_out       text;
  v_changed        boolean;
begin
  -- Identity + core field validation (mirrors materialize_external_media so the
  -- refresh path rejects the same malformed input with the same mapped errors).
  if v_source not in ('tmdb', 'openlibrary') then
    raise exception 'unknown provider'
      using errcode = '22023';
  end if;
  if v_ext = '' then
    raise exception 'external_id is required'
      using errcode = '22023';
  end if;
  if char_length(v_title) < 1 or char_length(v_title) > 300 then
    raise exception 'invalid title'
      using errcode = '22023',
            hint = 'title must be between 1 and 300 characters';
  end if;
  if p_year is null or p_year < 1800 or p_year > 2200 then
    raise exception 'invalid year'
      using errcode = '22023',
            hint = 'year must be between 1800 and 2200';
  end if;
  if p_content_hash is null or p_content_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid content hash'
      using errcode = '22023',
            hint = 'content_hash must be a 64-char lowercase hex SHA-256';
  end if;
  if v_version is null then
    raise exception 'normalization_version is required'
      using errcode = '22023';
  end if;
  if v_expected is not null and v_expected !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid expected content hash'
      using errcode = '22023',
            hint = 'expected_content_hash must be a 64-char lowercase hex SHA-256';
  end if;
  if p_average_rating is not null
     and (p_average_rating < 0 or p_average_rating > 5) then
    raise exception 'invalid average rating'
      using errcode = '22023',
            hint = 'average_rating must be between 0 and 5';
  end if;

  -- Serialize concurrent refreshes of the SAME provider identity so the read of
  -- current provenance and the conditional write cannot interleave.
  perform pg_advisory_xact_lock(hashtext(v_source || ':' || v_ext));

  -- Resolve an EXISTING canonical row: alias first, then a direct provider row
  -- (materialized before the alias existed). Refresh NEVER creates or links.
  select l.media_id into v_media_id
  from public.media_external_ids l
  where l.provider = v_source and l.kind = p_kind and l.external_id = v_ext;

  if v_media_id is null then
    select m.id into v_media_id
    from public.media_items m
    where m.source = v_source and m.external_id = v_ext;
  end if;

  if v_media_id is null then
    raise exception 'no such provider record'
      using errcode = 'P0002',
            hint = 'refresh operates only on an already-materialized provider record';
  end if;

  -- Load current ownership + provenance under the lock.
  select m.source, m.content_hash, m.normalization_version, m.provider_removed_at
    into v_row_source, v_stored_hash, v_stored_version, v_removed
  from public.media_items m
  where m.id = v_media_id;

  -- Curated protection: a provider refresh must never touch a favalog row, even
  -- when a provider identity is aliased to it.
  if v_row_source is distinct from v_source then
    raise exception 'curated record is not provider-refreshable'
      using errcode = 'P0004',
            hint = 'the resolved canonical row is not owned by this provider';
  end if;

  -- Optimistic concurrency: reject a stale writer whose observed baseline no
  -- longer matches the stored hash (a newer refresh already advanced the row).
  if v_expected is not null and v_stored_hash is distinct from v_expected then
    raise exception 'stale provider refresh'
      using errcode = 'P0005',
            hint = 'expected_content_hash does not match the current stored content hash';
  end if;

  -- A content change is a new payload hash, a new normalization format version,
  -- or a resurrection (the row was soft-removed and the provider now returns it).
  v_changed := (v_stored_hash is distinct from p_content_hash)
            or (v_stored_version is distinct from v_version)
            or (v_removed is not null);

  if v_changed then
    -- Genuine refresh: provider-controlled fields advance ATOMICALLY with the
    -- provenance columns that describe them, and any removal/failure state is
    -- cleared. The generated search_tsv follows the field changes automatically.
    update public.media_items m set
      subtitle              = nullif(btrim(coalesce(p_subtitle, '')), ''),
      synopsis              = coalesce(p_synopsis, ''),
      year                  = p_year,
      poster_url            = nullif(btrim(coalesce(p_poster_url, '')), ''),
      backdrop_url          = nullif(btrim(coalesce(p_backdrop_url, '')), ''),
      average_rating        = p_average_rating,
      genres                = coalesce(p_genres, '{}'),
      details               = coalesce(p_details, '{}'::jsonb),
      content_hash          = p_content_hash,
      normalization_version = v_version,
      synced_at             = v_synced,
      provider_checked_at   = v_synced,
      provider_removed_at   = null,
      refresh_failure_count = 0,
      last_refresh_error    = null,
      last_refresh_error_at = null
    where m.id = v_media_id
    returning m.slug into v_slug_out;
  else
    -- Successful freshness check with NO content change: record ONLY that we
    -- checked (and clear failure state). Content, content_hash, and synced_at
    -- are intentionally left intact so freshness never masquerades as a change.
    update public.media_items m set
      provider_checked_at   = v_synced,
      refresh_failure_count = 0,
      last_refresh_error    = null,
      last_refresh_error_at = null
    where m.id = v_media_id
    returning m.slug into v_slug_out;
  end if;

  return jsonb_build_object(
    'media_id', v_media_id, 'slug', v_slug_out, 'source', v_source,
    'external_id', v_ext, 'kind', p_kind,
    'outcome', case when v_changed then 'changed' else 'unchanged' end,
    'changed', v_changed, 'provider_checked_at', v_synced
  );
end;
$$;

comment on function public.refresh_external_media(text, public.media_kind, text, text, text, text, integer, text, text, numeric, text[], jsonb, text, text, text) is
  'Trusted server-only REFRESH of an already-materialized provider-owned public.media_items row from a normalized provider fetch. Resolves an existing provider identity (alias -> direct) WITHOUT creating/linking/re-slugging; preserves media id, slug, aliases, and all user data. Rejects an unknown identity (P0002), a curated resolved row (P0004), and a stale concurrent write whose expected_content_hash no longer matches (P0005). A new hash/version or a resurrection performs a full field+provenance refresh (outcome ''changed''); otherwise it records a successful freshness check only (outcome ''unchanged''), advancing provider_checked_at without touching content_hash/synced_at. SECURITY INVOKER; EXECUTE granted only to service_role. Returns { media_id, slug, source, external_id, kind, outcome, changed, provider_checked_at }.';

revoke all on function public.refresh_external_media(text, public.media_kind, text, text, text, text, integer, text, text, numeric, text[], jsonb, text, text, text) from public;
revoke all on function public.refresh_external_media(text, public.media_kind, text, text, text, text, integer, text, text, numeric, text[], jsonb, text, text, text) from anon;
revoke all on function public.refresh_external_media(text, public.media_kind, text, text, text, text, integer, text, text, numeric, text[], jsonb, text, text, text) from authenticated;
grant execute on function public.refresh_external_media(text, public.media_kind, text, text, text, text, integer, text, text, numeric, text[], jsonb, text, text, text) to service_role;

-- ---------------------------------------------------------------------------
-- 2b. mark_external_media_refresh_failed: record a TRANSIENT failure.
--
-- Used when the server's provider fetch failed in a way that is NOT a confirmed
-- removal (network error, timeout, 5xx, rate limit). It ONLY increments the
-- failure counter and records the reason; it NEVER removes/hides content, never
-- touches the normalized fields or provenance, and never touches a curated row.
-- ---------------------------------------------------------------------------
create or replace function public.mark_external_media_refresh_failed(
  p_source      text,
  p_kind        public.media_kind,
  p_external_id text,
  p_error       text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_source     text := btrim(coalesce(p_source, ''));
  v_ext        text := btrim(coalesce(p_external_id, ''));
  v_reason     text := left(coalesce(nullif(btrim(coalesce(p_error, '')), ''), 'unknown provider error'), 500);
  v_media_id   uuid;
  v_row_source text;
  v_slug_out   text;
  v_count      integer;
begin
  if v_source not in ('tmdb', 'openlibrary') then
    raise exception 'unknown provider'
      using errcode = '22023';
  end if;
  if v_ext = '' then
    raise exception 'external_id is required'
      using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtext(v_source || ':' || v_ext));

  select l.media_id into v_media_id
  from public.media_external_ids l
  where l.provider = v_source and l.kind = p_kind and l.external_id = v_ext;

  if v_media_id is null then
    select m.id into v_media_id
    from public.media_items m
    where m.source = v_source and m.external_id = v_ext;
  end if;

  if v_media_id is null then
    raise exception 'no such provider record'
      using errcode = 'P0002',
            hint = 'a failed refresh can only be recorded against an existing provider record';
  end if;

  select m.source into v_row_source
  from public.media_items m
  where m.id = v_media_id;

  if v_row_source is distinct from v_source then
    raise exception 'curated record is not provider-refreshable'
      using errcode = 'P0004',
            hint = 'the resolved canonical row is not owned by this provider';
  end if;

  -- A transient failure NEVER removes/hides content and NEVER touches the
  -- normalized fields, content_hash, synced_at, or provider_checked_at (the
  -- check did not succeed). It only advances the failure bookkeeping.
  update public.media_items m set
    refresh_failure_count = m.refresh_failure_count + 1,
    last_refresh_error    = v_reason,
    last_refresh_error_at = now()
  where m.id = v_media_id
  returning m.slug, m.refresh_failure_count into v_slug_out, v_count;

  return jsonb_build_object(
    'media_id', v_media_id, 'slug', v_slug_out, 'source', v_source,
    'external_id', v_ext, 'kind', p_kind, 'outcome', 'transient_failure',
    'refresh_failure_count', v_count
  );
end;
$$;

comment on function public.mark_external_media_refresh_failed(text, public.media_kind, text, text) is
  'Trusted server-only record of a TRANSIENT provider-refresh failure (network/timeout/5xx/rate-limit — NOT a confirmed removal) against an existing provider-owned row. Increments refresh_failure_count and records the reason; never removes/hides content, never touches normalized fields or provenance, never touches a curated row (P0004) or an unknown identity (P0002). SECURITY INVOKER; EXECUTE granted only to service_role. Returns { media_id, slug, source, external_id, kind, outcome, refresh_failure_count }.';

revoke all on function public.mark_external_media_refresh_failed(text, public.media_kind, text, text) from public;
revoke all on function public.mark_external_media_refresh_failed(text, public.media_kind, text, text) from anon;
revoke all on function public.mark_external_media_refresh_failed(text, public.media_kind, text, text) from authenticated;
grant execute on function public.mark_external_media_refresh_failed(text, public.media_kind, text, text) to service_role;

-- ---------------------------------------------------------------------------
-- 2c. mark_external_media_removed: record a CONFIRMED provider removal.
--
-- Used when the server CONFIRMED (e.g. provider 404/410) that a provider record
-- is gone. It soft-removes the canonical row so public discovery stops exposing
-- it, WITHOUT deleting the media row, its aliases, or ANY user-owned rows. The
-- first removal stamps provider_removed_at; a repeat is idempotent. A curated
-- row is never marked removed (P0004).
-- ---------------------------------------------------------------------------
create or replace function public.mark_external_media_removed(
  p_source      text,
  p_kind        public.media_kind,
  p_external_id text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_source     text := btrim(coalesce(p_source, ''));
  v_ext        text := btrim(coalesce(p_external_id, ''));
  v_now        timestamptz := now();
  v_media_id   uuid;
  v_row_source text;
  v_slug_out   text;
  v_removed    timestamptz;
begin
  if v_source not in ('tmdb', 'openlibrary') then
    raise exception 'unknown provider'
      using errcode = '22023';
  end if;
  if v_ext = '' then
    raise exception 'external_id is required'
      using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtext(v_source || ':' || v_ext));

  select l.media_id into v_media_id
  from public.media_external_ids l
  where l.provider = v_source and l.kind = p_kind and l.external_id = v_ext;

  if v_media_id is null then
    select m.id into v_media_id
    from public.media_items m
    where m.source = v_source and m.external_id = v_ext;
  end if;

  if v_media_id is null then
    raise exception 'no such provider record'
      using errcode = 'P0002',
            hint = 'a removal can only be recorded against an existing provider record';
  end if;

  select m.source into v_row_source
  from public.media_items m
  where m.id = v_media_id;

  if v_row_source is distinct from v_source then
    raise exception 'curated record is not provider-refreshable'
      using errcode = 'P0004',
            hint = 'a curated record is never marked removed by a provider';
  end if;

  -- Soft removal: stamp provider_removed_at on the FIRST confirmation (idempotent
  -- thereafter) and record that we successfully checked the provider state. The
  -- media row, its aliases, and every user-owned reference are left intact; the
  -- row is hidden from discovery by the removal-aware retrieval functions below.
  update public.media_items m set
    provider_removed_at   = coalesce(m.provider_removed_at, v_now),
    provider_checked_at   = v_now,
    refresh_failure_count = 0,
    last_refresh_error    = null,
    last_refresh_error_at = null
  where m.id = v_media_id
  returning m.slug, m.provider_removed_at into v_slug_out, v_removed;

  return jsonb_build_object(
    'media_id', v_media_id, 'slug', v_slug_out, 'source', v_source,
    'external_id', v_ext, 'kind', p_kind, 'outcome', 'removed',
    'provider_removed_at', v_removed
  );
end;
$$;

comment on function public.mark_external_media_removed(text, public.media_kind, text) is
  'Trusted server-only record of a CONFIRMED provider removal (e.g. 404/410) against an existing provider-owned row. Soft-removes the canonical row (stamps provider_removed_at, idempotent) so public discovery stops exposing it, WITHOUT deleting the media row, its aliases, or any user-owned rows; a later successful refresh clears it (resurrection). Never marks a curated row removed (P0004) or an unknown identity (P0002). SECURITY INVOKER; EXECUTE granted only to service_role. Returns { media_id, slug, source, external_id, kind, outcome, provider_removed_at }.';

revoke all on function public.mark_external_media_removed(text, public.media_kind, text) from public;
revoke all on function public.mark_external_media_removed(text, public.media_kind, text) from anon;
revoke all on function public.mark_external_media_removed(text, public.media_kind, text) from authenticated;
grant execute on function public.mark_external_media_removed(text, public.media_kind, text) to service_role;

-- ---------------------------------------------------------------------------
-- 3. Removal-aware retrieval (forward-only recreate).
--
-- A soft-removed provider row must stop appearing in public discovery while
-- every user reference to it survives. The three retrieval functions are
-- recreated IDENTICALLY to their current definitions (keyword_search from
-- 20260815120200; the provenance-guarded semantic_search / hybrid_search from
-- 20260815120300) with the SOLE addition of `provider_removed_at is null` in the
-- catalog-scanning arms. Curated rows (provider_removed_at always null) and all
-- present provider rows are unaffected. Security posture is unchanged and the
-- EXECUTE grants are restated for self-containment.
-- ---------------------------------------------------------------------------
create or replace function public.keyword_search(
  p_query text,
  p_kind  public.media_kind default null,
  p_limit integer default 24
)
returns table (
  media_id       uuid,
  slug           text,
  kind           public.media_kind,
  title          text,
  subtitle       text,
  synopsis       text,
  year           integer,
  poster_url     text,
  backdrop_url   text,
  average_rating numeric,
  genres         text[],
  details        jsonb,
  rank           real
)
language sql
stable
security invoker
set search_path = ''
as $$
  with q as (
    select
      websearch_to_tsquery('english'::regconfig, coalesce(p_query, '')) as query,
      lower(btrim(coalesce(p_query, ''))) as norm
  )
  select
    mi.id, mi.slug, mi.kind, mi.title, mi.subtitle, mi.synopsis, mi.year,
    mi.poster_url, mi.backdrop_url, mi.average_rating, mi.genres, mi.details,
    ts_rank_cd(mi.search_tsv, q.query)::real as rank
  from public.media_items mi, q
  where q.norm <> ''
    and mi.provider_removed_at is null
    and (mi.search_tsv @@ q.query or lower(mi.title) = q.norm)
    and (p_kind is null or mi.kind = p_kind)
  order by
    (lower(mi.title) = q.norm) desc,
    ts_rank_cd(mi.search_tsv, q.query) desc,
    mi.year desc,
    mi.id
  limit least(greatest(coalesce(p_limit, 24), 1), 50)
$$;

comment on function public.keyword_search(text, public.media_kind, integer) is
  'Deterministic lexical catalog retrieval over media_items.search_tsv (SECURITY INVOKER). Excludes soft-removed provider rows (provider_removed_at is not null). Exact-title matches sort first. Untrusted text is parsed with websearch_to_tsquery (never interpolated). Returns safe catalog fields + a ts_rank_cd rank; result count clamped to [1,50]. Works with zero embeddings (the keyword-only fallback).';

create or replace function public.semantic_search(
  p_query_embedding  extensions.vector(512),
  p_provider         text,
  p_model            text,
  p_dimensions       integer,
  p_document_version text,
  p_kind             public.media_kind default null,
  p_limit            integer default 24
)
returns table (
  media_id       uuid,
  slug           text,
  kind           public.media_kind,
  title          text,
  subtitle       text,
  synopsis       text,
  year           integer,
  poster_url     text,
  backdrop_url   text,
  average_rating numeric,
  genres         text[],
  details        jsonb,
  rank           real
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    mi.id, mi.slug, mi.kind, mi.title, mi.subtitle, mi.synopsis, mi.year,
    mi.poster_url, mi.backdrop_url, mi.average_rating, mi.genres, mi.details,
    (1.0 / (1.0 + (d.embedding operator(extensions.<=>) p_query_embedding)))::real as rank
  from public.media_search_documents d
  join public.media_items mi on mi.id = d.media_id
  where p_query_embedding is not null
    and d.embedding is not null
    and mi.provider_removed_at is null
    and d.embedding_provider = p_provider
    and d.embedding_model = p_model
    and d.embedding_dimensions = p_dimensions
    and d.document_version = p_document_version
    and (p_kind is null or mi.kind = p_kind)
  order by
    d.embedding operator(extensions.<=>) p_query_embedding asc,
    mi.id
  limit least(greatest(coalesce(p_limit, 24), 1), 50)
$$;

comment on function public.semantic_search(extensions.vector, text, text, integer, text, public.media_kind, integer) is
  'Provenance-guarded cosine nearest-neighbour retrieval over the PRIVATE media_search_documents table. Excludes soft-removed provider rows (provider_removed_at is not null). Only rows whose stored provider/model/dimensions/document_version match the SERVER-supplied expected identity participate. SECURITY DEFINER, pinned empty search_path, read-only. Returns only safe catalog fields + a distance-derived rank (never the raw vector); result count clamped to [1,50].';

create or replace function public.hybrid_search(
  p_query            text,
  p_query_embedding  extensions.vector(512),
  p_provider         text,
  p_model            text,
  p_dimensions       integer,
  p_document_version text,
  p_kind             public.media_kind default null,
  p_limit            integer default 24
)
returns table (
  media_id       uuid,
  slug           text,
  kind           public.media_kind,
  title          text,
  subtitle       text,
  synopsis       text,
  year           integer,
  poster_url     text,
  backdrop_url   text,
  average_rating numeric,
  genres         text[],
  details        jsonb,
  rank           real
)
language sql
stable
security definer
set search_path = ''
as $$
  with q as (
    select
      websearch_to_tsquery('english'::regconfig, coalesce(p_query, '')) as query,
      lower(btrim(coalesce(p_query, ''))) as norm
  ),
  kw as (
    select
      mi.id,
      row_number() over (
        order by ts_rank_cd(mi.search_tsv, q.query) desc, mi.year desc, mi.id
      ) as rank
    from public.media_items mi, q
    where q.norm <> ''
      and mi.provider_removed_at is null
      and (mi.search_tsv @@ q.query or lower(mi.title) = q.norm)
      and (p_kind is null or mi.kind = p_kind)
    order by rank
    limit 50
  ),
  sem as (
    select
      d.media_id as id,
      row_number() over (
        order by d.embedding operator(extensions.<=>) p_query_embedding asc, d.media_id
      ) as rank
    from public.media_search_documents d
    join public.media_items mi on mi.id = d.media_id
    where p_query_embedding is not null
      and d.embedding is not null
      and mi.provider_removed_at is null
      and d.embedding_provider = p_provider
      and d.embedding_model = p_model
      and d.embedding_dimensions = p_dimensions
      and d.document_version = p_document_version
      and (p_kind is null or mi.kind = p_kind)
    order by rank
    limit 50
  ),
  fused as (
    select
      coalesce(kw.id, sem.id) as id,
      coalesce(1.0 / (60 + kw.rank), 0) + coalesce(1.0 / (60 + sem.rank), 0) as score
    from kw
    full outer join sem on kw.id = sem.id
  )
  select
    mi.id, mi.slug, mi.kind, mi.title, mi.subtitle, mi.synopsis, mi.year,
    mi.poster_url, mi.backdrop_url, mi.average_rating, mi.genres, mi.details,
    f.score::real as rank
  from fused f
  join public.media_items mi on mi.id = f.id
  cross join q
  order by
    (lower(mi.title) = q.norm) desc,
    f.score desc,
    mi.year desc,
    mi.id
  limit least(greatest(coalesce(p_limit, 24), 1), 50)
$$;

comment on function public.hybrid_search(text, extensions.vector, text, text, integer, text, public.media_kind, integer) is
  'Provenance-guarded hybrid catalog retrieval: reciprocal-rank fusion (k=60) of the lexical arm (media_items FTS) and the provenance-guarded semantic arm, with exact-title protection. Excludes soft-removed provider rows (provider_removed_at is not null) from both arms. SECURITY DEFINER (reads the private embedding table), pinned empty search_path, read-only, no dynamic SQL. Returns only safe catalog fields + a fused rank; result count clamped to [1,50].';

-- Restate the EXECUTE grants (create-or-replace preserves them; restated here so
-- the security posture is explicit and self-contained after the recreate).
revoke all on function public.keyword_search(text, public.media_kind, integer) from public;
grant execute on function public.keyword_search(text, public.media_kind, integer) to anon;
grant execute on function public.keyword_search(text, public.media_kind, integer) to authenticated;

revoke all on function public.semantic_search(extensions.vector, text, text, integer, text, public.media_kind, integer) from public;
grant execute on function public.semantic_search(extensions.vector, text, text, integer, text, public.media_kind, integer) to anon;
grant execute on function public.semantic_search(extensions.vector, text, text, integer, text, public.media_kind, integer) to authenticated;

revoke all on function public.hybrid_search(text, extensions.vector, text, text, integer, text, public.media_kind, integer) from public;
grant execute on function public.hybrid_search(text, extensions.vector, text, text, integer, text, public.media_kind, integer) to anon;
grant execute on function public.hybrid_search(text, extensions.vector, text, text, integer, text, public.media_kind, integer) to authenticated;
