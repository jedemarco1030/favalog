-- Favalog Catalog Platform v1A: trusted external-provider ingestion.
--
-- Extends the existing unified catalog (public.media_items) so titles can be
-- materialized from trusted external providers (TMDB for movies/TV, Open Library
-- for books) WITHOUT changing any existing identity, slug, URL, or the curated
-- source='favalog' rows. It adds:
--   1. Provenance columns for provider-sourced rows (staleness + refresh).
--   2. public.materialize_media_item(...): one atomic, idempotent,
--      concurrency-safe, collision-safe server-only write path.
--
-- Reuses the existing (source, external_id) identity model laid down in
-- 20260805150200_media_items.sql: `source` carries the provider id
-- ('tmdb' | 'openlibrary'); `external_id` carries the provider-native id,
-- kind-qualified for TMDB (e.g. 'movie:603' / 'tv:1399') so a movie and a TV
-- show that share a numeric TMDB id can never collide. Open Library uses its
-- globally-unique Work id (e.g. 'OL45804W'). The unique index
-- media_items_source_external_id_key remains the identity authority.
--
-- Forward-only: existing migrations are NOT edited. No user data is touched.

-- ---------------------------------------------------------------------------
-- 1. Provenance columns.
--
-- These describe WHERE a provider-sourced row came from and WHETHER our stored
-- copy is current, without storing the raw provider payload:
--   * content_hash          — deterministic SHA-256 (hex) of the normalized
--                             product; a change signals stale data to refresh.
--   * normalization_version — the normalization FORMAT version the row was
--                             produced under; a bump marks rows for re-sync.
--   * synced_at             — the last successful synchronization time.
-- All are nullable so curated source='favalog' rows (which have no external
-- provenance) remain valid and untouched.
-- ---------------------------------------------------------------------------
alter table public.media_items
  add column if not exists content_hash text,
  add column if not exists normalization_version text,
  add column if not exists synced_at timestamptz;

alter table public.media_items
  drop constraint if exists media_items_content_hash_format;
alter table public.media_items
  add constraint media_items_content_hash_format
    check (content_hash is null or content_hash ~ '^[0-9a-f]{64}$');

comment on column public.media_items.content_hash is
  'Deterministic SHA-256 (hex) of the normalized provider product. Null for curated rows. Drives provider-data staleness detection for a controlled re-sync.';
comment on column public.media_items.normalization_version is
  'Normalization FORMAT version the row was materialized under. Null for curated rows. A bump marks provider rows for re-sync.';
comment on column public.media_items.synced_at is
  'Timestamp of the last successful provider synchronization. Null for curated rows.';

-- Provider-scoped access (e.g. "all tmdb rows") without scanning the catalog.
create index if not exists media_items_source_idx
  on public.media_items (source);

-- ---------------------------------------------------------------------------
-- 2. materialize_media_item: the single trusted write path.
--
-- SECURITY MODEL:
--   * SECURITY INVOKER + pinned search_path = '' + fully schema-qualified. The
--     function is NOT a privilege-escalation surface; RLS remains fully in
--     force for the caller. Only the trusted server-side process (service_role,
--     which the app's admin client uses) may EXECUTE it — EXECUTE is revoked
--     from public/anon/authenticated. A browser role can never call it.
--   * The caller (the server, after re-fetching + normalizing trusted upstream
--     detail) supplies the normalized product. Untrusted browser/CLI input is
--     limited upstream to { provider, kind, external id }; titles, images,
--     slugs, ratings, and ownership are NEVER accepted from a browser.
--
-- IDENTITY + IMMUTABLE SLUG:
--   * The row id is a deterministic md5(source || ':' || external_id)::uuid, so
--     the same title maps to the same UUID across environments and re-runs
--     (matching the curated identity bridge). Idempotency is enforced by
--     ON CONFLICT (source, external_id): a re-import UPDATES the mutable
--     presentation/provenance columns and NEVER changes id or slug.
--   * The slug is generated server-side from the title and is IMMUTABLE. A slug
--     collision with a DIFFERENT identity is resolved by a deterministic numeric
--     suffix via the INSERT (the unique index is the authority), so an existing
--     title's URL is never modified.
--
-- CONCURRENCY: two concurrent imports of the SAME identity race on the
--   (source, external_id) unique index; ON CONFLICT makes the loser an update,
--   so there is never a duplicate. A concurrent slug collision with a different
--   identity surfaces as unique_violation and retries with the next suffix.
--
-- Returns identifiers/routing data only:
--   { media_id, slug, source, external_id, kind, inserted, synced_at }.
-- ---------------------------------------------------------------------------
create or replace function public.materialize_media_item(
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
  p_normalization_version text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_source   text := btrim(coalesce(p_source, ''));
  v_ext      text := btrim(coalesce(p_external_id, ''));
  v_title    text := btrim(coalesce(p_title, ''));
  v_version  text := nullif(btrim(coalesce(p_normalization_version, '')), '');
  v_base     text;
  v_slug     text;
  v_suffix   int := 1;
  v_id       uuid;
  v_media_id uuid;
  v_slug_out text;
  v_inserted boolean;
  v_synced   timestamptz := now();
begin
  -- Validate identity + core fields up front for clean, mapped errors (the
  -- table CHECKs enforce the same bounds as an independent second boundary).
  if v_source = '' then
    raise exception 'source is required'
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
  if p_average_rating is not null
     and (p_average_rating < 0 or p_average_rating > 5) then
    raise exception 'invalid average rating'
      using errcode = '22023',
            hint = 'average_rating must be between 0 and 5';
  end if;

  -- Deterministic UUID from the canonical provider identity.
  v_id := md5(v_source || ':' || v_ext)::uuid;

  -- Readable, immutable base slug from the title.
  v_base := btrim(regexp_replace(lower(v_title), '[^a-z0-9]+', '-', 'g'), '-');
  if v_base is null or v_base = '' then
    v_base := p_kind::text;
  end if;
  v_slug := v_base;

  -- Insert (or refresh on identity conflict) with a collision-safe slug. The
  -- INSERT is the authority for uniqueness. ON CONFLICT (source, external_id)
  -- makes a re-import an idempotent UPDATE that never rewrites id or slug; a
  -- unique_violation therefore can only be a slug collision with a DIFFERENT
  -- identity, which bumps the suffix and retries.
  loop
    begin
      insert into public.media_items (
        id, kind, source, external_id, slug, title, subtitle, synopsis, year,
        poster_url, backdrop_url, average_rating, genres, details,
        content_hash, normalization_version, synced_at
      ) values (
        v_id, p_kind, v_source, v_ext, v_slug, v_title,
        nullif(btrim(coalesce(p_subtitle, '')), ''),
        coalesce(p_synopsis, ''),
        p_year,
        nullif(btrim(coalesce(p_poster_url, '')), ''),
        nullif(btrim(coalesce(p_backdrop_url, '')), ''),
        p_average_rating,
        coalesce(p_genres, '{}'),
        coalesce(p_details, '{}'::jsonb),
        p_content_hash, v_version, v_synced
      )
      on conflict (source, external_id) do update set
        kind                  = excluded.kind,
        title                 = excluded.title,
        subtitle              = excluded.subtitle,
        synopsis              = excluded.synopsis,
        year                  = excluded.year,
        poster_url            = excluded.poster_url,
        backdrop_url          = excluded.backdrop_url,
        average_rating        = excluded.average_rating,
        genres                = excluded.genres,
        details               = excluded.details,
        content_hash          = excluded.content_hash,
        normalization_version = excluded.normalization_version,
        synced_at             = excluded.synced_at,
        updated_at            = now()
      returning id, slug, (xmax = 0) into v_media_id, v_slug_out, v_inserted;
      exit;
    exception when unique_violation then
      v_suffix := v_suffix + 1;
      if v_suffix > 1000 then
        raise exception 'could not generate a unique media slug'
          using errcode = '55000';
      end if;
      v_slug := v_base || '-' || v_suffix;
    end;
  end loop;

  return jsonb_build_object(
    'media_id',    v_media_id,
    'slug',        v_slug_out,
    'source',      v_source,
    'external_id', v_ext,
    'kind',        p_kind,
    'inserted',    v_inserted,
    'synced_at',   v_synced
  );
end;
$$;

comment on function public.materialize_media_item(text, public.media_kind, text, text, text, text, integer, text, text, numeric, text[], jsonb, text, text) is
  'Trusted server-only materialization of a normalized external catalog record into public.media_items. Atomic + idempotent (ON CONFLICT on the (source, external_id) identity), concurrency-safe, and collision-safe (server-generated immutable slug with deterministic suffixing). SECURITY INVOKER; EXECUTE granted only to service_role. Returns { media_id, slug, source, external_id, kind, inserted, synced_at } — identifiers only.';

revoke all on function public.materialize_media_item(text, public.media_kind, text, text, text, text, integer, text, text, numeric, text[], jsonb, text, text) from public;
revoke all on function public.materialize_media_item(text, public.media_kind, text, text, text, text, integer, text, text, numeric, text[], jsonb, text, text) from anon;
revoke all on function public.materialize_media_item(text, public.media_kind, text, text, text, text, integer, text, text, numeric, text[], jsonb, text, text) from authenticated;
grant execute on function public.materialize_media_item(text, public.media_kind, text, text, text, text, integer, text, text, numeric, text[], jsonb, text, text) to service_role;
