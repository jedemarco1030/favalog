-- Favalog Catalog Platform v1B: canonical external identity + on-demand
-- materialization with conservative deterministic entity resolution.
--
-- v1A keyed identity purely on public.media_items (source, external_id). That is
-- insufficient for v1B because a curated source='favalog' row can represent the
-- SAME real-world work as a TMDB or Open Library result (e.g. the curated
-- 'Dune: Part Two' movie is the same film as TMDB movie 693134). Materializing
-- the provider result under (source='tmdb', external_id='movie:693134') would
-- create a SECOND row for a title Favalog already has, splitting diary entries,
-- reviews, lists, and favorites across two ids.
--
-- This migration adds a forward-only canonical identity model:
--   1. public.media_external_ids — an alias table linking a canonical
--      public.media_items row to one or more provider identities.
--   2. public.materialize_external_media(...) — a trusted, server-only,
--      atomic, idempotent, concurrency-safe write path that CANONICALLY
--      RESOLVES a provider identity before writing:
--        a. exact existing provider link         -> reuse (resolution 'existing')
--        b. exact existing (source, external_id)  -> link + reuse ('existing')
--        c. conservative deterministic candidate  -> link existing ('linked')
--           (exact normalized title + kind + year, EXACTLY one match)
--        d. otherwise                             -> create a new row ('created')
--      An ambiguous deterministic match (more than one candidate, or a
--      candidate already linked to a different provider identity of the same
--      provider+kind) FAILS SAFELY rather than attaching to the wrong title.
--
-- Never uses fuzzy/semantic similarity to merge identities. Existing media ids,
-- immutable slugs, community ratings, and user-generated data are preserved.
-- Forward-only: existing migrations are NOT edited. No user data is touched.

-- ---------------------------------------------------------------------------
-- 1. Canonical external identity (alias) table.
--
-- One canonical public.media_items row may be reachable by several provider
-- identities (e.g. a curated row later linked to its TMDB id). A provider
-- identity, in turn, points to exactly one canonical row.
--
--   * unique (provider, kind, external_id) — a provider identity resolves to at
--     most one canonical media item (the identity authority for resolution).
--   * unique (media_id, provider, kind)     — a canonical media item carries at
--     most one identity PER provider+kind, so a second, DIFFERENT provider id
--     for the same title surfaces as a conflict and is rejected as ambiguous
--     rather than silently attached.
--   * FK to media_items ON DELETE CASCADE   — deleting a canonical row removes
--     its dangling aliases; there is never an orphaned link.
-- ---------------------------------------------------------------------------
create table if not exists public.media_external_ids (
  id uuid primary key default gen_random_uuid(),
  media_id uuid not null
    references public.media_items (id) on delete cascade,
  -- Provider id ('tmdb' | 'openlibrary'); a closed set mirroring the app's
  -- ExternalProvider union, enforced by a CHECK rather than an open string.
  provider text not null,
  kind public.media_kind not null,
  -- Provider-native identity, stored identically to media_items.external_id for
  -- a provider row: kind-qualified for TMDB ('movie:693134' / 'tv:1399'),
  -- the globally-unique Work id for Open Library ('OL45804W').
  external_id text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint media_external_ids_provider_check
    check (provider in ('tmdb', 'openlibrary')),
  constraint media_external_ids_external_id_length
    check (char_length(external_id) between 1 and 200),
  constraint media_external_ids_provider_identity_key
    unique (provider, kind, external_id),
  constraint media_external_ids_media_provider_kind_key
    unique (media_id, provider, kind)
);

comment on table public.media_external_ids is
  'Canonical external identity aliases: links a canonical public.media_items row to provider (TMDB / Open Library) identities. The single authority for de-duplicating an external result to an existing Favalog title. Publicly readable (identity only); writes are restricted to the trusted server-side process via materialize_external_media.';

-- Reverse lookup: all provider identities for a canonical media item.
create index if not exists media_external_ids_media_id_idx
  on public.media_external_ids (media_id);

create trigger media_external_ids_set_updated_at
  before update on public.media_external_ids
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 2. Row Level Security.
--
-- The alias table carries identity only (no user data). It is publicly readable
-- so any visitor's Explore can de-duplicate an external result to a canonical
-- title, matching the public-read posture of public.media_items. Writes are
-- NOT expressible by anon/authenticated: no write policy exists, and table
-- privileges below withhold INSERT/UPDATE/DELETE from browser roles. Only the
-- trusted server-side process (service_role, which bypasses RLS) writes, and
-- only through materialize_external_media.
-- ---------------------------------------------------------------------------
alter table public.media_external_ids enable row level security;

drop policy if exists media_external_ids_public_read on public.media_external_ids;
create policy media_external_ids_public_read
  on public.media_external_ids
  for select
  using (true);

-- Least-privilege table grants: browser roles may only read.
revoke all on table public.media_external_ids from public;
revoke all on table public.media_external_ids from anon;
revoke all on table public.media_external_ids from authenticated;
grant select on table public.media_external_ids to anon;
grant select on table public.media_external_ids to authenticated;
grant all on table public.media_external_ids to service_role;

-- ---------------------------------------------------------------------------
-- 3. materialize_external_media: the canonical-resolving trusted write path.
--
-- Same security model and normalized inputs as v1A's materialize_media_item
-- (SECURITY INVOKER, pinned empty search_path, fully schema-qualified, EXECUTE
-- granted only to service_role, identity-only return). The caller (the server,
-- after re-fetching + normalizing trusted upstream detail) supplies the
-- normalized product plus the provider identity; untrusted browser input is
-- limited upstream to { provider, kind, external id }.
--
-- CANONICAL RESOLUTION (never fuzzy/semantic):
--   1. Exact existing provider link (media_external_ids) -> reuse.
--   2. Exact existing provider row (media_items source/external_id) -> link + reuse.
--   3. Conservative deterministic candidate: EXACTLY one media_items row whose
--      normalized title + kind + year match -> attach the provider identity to
--      that existing row (no new media row). More than one match, or a candidate
--      already linked to a different identity of this provider+kind, FAILS
--      SAFELY (P0003) rather than mis-attaching.
--   4. No match -> create a new media_items row (collision-safe immutable slug).
--
-- When an existing curated title is matched, its media id, immutable slug,
-- community average_rating, title, year, and genres are PRESERVED. Only genuine
-- provider-controlled presentation fields are filled WHEN CURRENTLY EMPTY, and
-- provenance (content_hash / normalization_version / synced_at) is recorded.
--
-- CONCURRENCY: a transaction-scoped advisory lock keyed on the provider
-- identity serializes concurrent imports of the SAME identity; the unique
-- constraints remain the ultimate authority. Returns identifiers + the
-- resolution outcome only:
--   { media_id, slug, source, external_id, kind, inserted, synced_at, resolution }.
-- ---------------------------------------------------------------------------
create or replace function public.materialize_external_media(
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
  v_source     text := btrim(coalesce(p_source, ''));
  v_ext        text := btrim(coalesce(p_external_id, ''));
  v_title      text := btrim(coalesce(p_title, ''));
  v_version    text := nullif(btrim(coalesce(p_normalization_version, '')), '');
  v_norm_title text;
  v_base       text;
  v_slug       text;
  v_suffix     int := 1;
  v_id         uuid;
  v_media_id   uuid;
  v_slug_out   text;
  v_inserted   boolean;
  v_synced     timestamptz := now();
  v_resolution text;
  v_cand_count int;
  v_cand_id    uuid;
begin
  -- Identity + core field validation (mirrors materialize_media_item so both
  -- write paths reject the same malformed input with the same mapped errors).
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
  if p_average_rating is not null
     and (p_average_rating < 0 or p_average_rating > 5) then
    raise exception 'invalid average rating'
      using errcode = '22023',
            hint = 'average_rating must be between 0 and 5';
  end if;

  -- Serialize concurrent imports of the SAME provider identity. The unique
  -- constraints are still the ultimate authority; this just avoids needless
  -- deterministic-candidate races producing avoidable conflicts.
  perform pg_advisory_xact_lock(hashtext(v_source || ':' || v_ext));

  -- Deterministic normalized title used ONLY for conservative candidate
  -- matching: lowercase, non-alphanumerics collapsed to single spaces, trimmed.
  -- This is exact-normalized equality, never fuzzy or semantic similarity.
  v_norm_title := btrim(regexp_replace(lower(v_title), '[^a-z0-9]+', ' ', 'g'));

  -- (1) Exact existing provider link -> reuse the canonical row.
  select l.media_id into v_media_id
  from public.media_external_ids l
  where l.provider = v_source and l.kind = p_kind and l.external_id = v_ext;

  if v_media_id is not null then
    -- Refresh provider-controlled metadata ONLY on provider-sourced rows; a
    -- curated (source='favalog') row's presentation is never overwritten.
    update public.media_items m set
      title                 = m.title,
      subtitle              = coalesce(m.subtitle, nullif(btrim(coalesce(p_subtitle, '')), '')),
      synopsis              = case when coalesce(m.synopsis, '') = '' then coalesce(p_synopsis, '') else m.synopsis end,
      poster_url            = coalesce(m.poster_url, nullif(btrim(coalesce(p_poster_url, '')), '')),
      backdrop_url          = coalesce(m.backdrop_url, nullif(btrim(coalesce(p_backdrop_url, '')), '')),
      content_hash          = p_content_hash,
      normalization_version = v_version,
      synced_at             = v_synced,
      updated_at            = now()
    where m.id = v_media_id and m.source = v_source
    returning m.slug into v_slug_out;

    if v_slug_out is null then
      select m.slug into v_slug_out from public.media_items m where m.id = v_media_id;
    end if;

    return jsonb_build_object(
      'media_id', v_media_id, 'slug', v_slug_out, 'source', v_source,
      'external_id', v_ext, 'kind', p_kind, 'inserted', false,
      'synced_at', v_synced, 'resolution', 'existing'
    );
  end if;

  -- (2) Exact existing provider ROW (materialized before the alias existed, or
  -- via v1A's materialize_media_item). Backfill the alias link and refresh.
  select m.id into v_media_id
  from public.media_items m
  where m.source = v_source and m.external_id = v_ext;

  if v_media_id is not null then
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
      updated_at            = now()
    where m.id = v_media_id
    returning m.slug into v_slug_out;

    insert into public.media_external_ids (media_id, provider, kind, external_id)
    values (v_media_id, v_source, p_kind, v_ext)
    on conflict (provider, kind, external_id) do nothing;

    return jsonb_build_object(
      'media_id', v_media_id, 'slug', v_slug_out, 'source', v_source,
      'external_id', v_ext, 'kind', p_kind, 'inserted', false,
      'synced_at', v_synced, 'resolution', 'existing'
    );
  end if;

  -- (3) Conservative deterministic candidate: exact normalized title + kind +
  -- year. Requires EXACTLY one match; anything else fails safely.
  select count(*)
    into v_cand_count
  from public.media_items m
  where m.kind = p_kind
    and m.year = p_year
    and btrim(regexp_replace(lower(m.title), '[^a-z0-9]+', ' ', 'g')) = v_norm_title;

  if v_cand_count = 1 then
    select m.id
      into v_cand_id
    from public.media_items m
    where m.kind = p_kind
      and m.year = p_year
      and btrim(regexp_replace(lower(m.title), '[^a-z0-9]+', ' ', 'g')) = v_norm_title;
  end if;

  if v_cand_count > 1 then
    raise exception 'ambiguous external identity match'
      using errcode = 'P0003',
            hint = 'more than one existing title matches the deterministic candidate';
  end if;

  if v_cand_count = 1 then
    -- Attach the provider identity to the existing canonical row WITHOUT
    -- creating a new media_items row. A pre-existing DIFFERENT identity for the
    -- same provider+kind violates media_external_ids_media_provider_kind_key and
    -- is rejected as ambiguous (fail safe, never mis-attach).
    begin
      insert into public.media_external_ids (media_id, provider, kind, external_id)
      values (v_cand_id, v_source, p_kind, v_ext);
    exception
      when unique_violation then
        raise exception 'ambiguous external identity match'
          using errcode = 'P0003',
                hint = 'candidate title already carries a different identity for this provider and kind';
    end;

    -- Provider-metadata policy: fill genuinely EMPTY presentation fields only;
    -- never overwrite community average_rating, title, slug, year, or genres.
    update public.media_items m set
      subtitle              = coalesce(m.subtitle, nullif(btrim(coalesce(p_subtitle, '')), '')),
      synopsis              = case when coalesce(m.synopsis, '') = '' then coalesce(p_synopsis, '') else m.synopsis end,
      poster_url            = coalesce(m.poster_url, nullif(btrim(coalesce(p_poster_url, '')), '')),
      backdrop_url          = coalesce(m.backdrop_url, nullif(btrim(coalesce(p_backdrop_url, '')), '')),
      content_hash          = coalesce(m.content_hash, p_content_hash),
      normalization_version = coalesce(m.normalization_version, v_version),
      synced_at             = v_synced,
      updated_at            = now()
    where m.id = v_cand_id
    returning m.slug into v_slug_out;

    return jsonb_build_object(
      'media_id', v_cand_id, 'slug', v_slug_out, 'source', v_source,
      'external_id', v_ext, 'kind', p_kind, 'inserted', false,
      'synced_at', v_synced, 'resolution', 'linked'
    );
  end if;

  -- (4) No canonical match -> create a new provider row with a collision-safe
  -- immutable slug (identical strategy to materialize_media_item) and link it.
  v_id := md5(v_source || ':' || v_ext)::uuid;
  v_base := btrim(regexp_replace(lower(v_title), '[^a-z0-9]+', '-', 'g'), '-');
  if v_base is null or v_base = '' then
    v_base := p_kind::text;
  end if;
  v_slug := v_base;

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

  insert into public.media_external_ids (media_id, provider, kind, external_id)
  values (v_media_id, v_source, p_kind, v_ext)
  on conflict (provider, kind, external_id) do nothing;

  v_resolution := case when v_inserted then 'created' else 'existing' end;

  return jsonb_build_object(
    'media_id', v_media_id, 'slug', v_slug_out, 'source', v_source,
    'external_id', v_ext, 'kind', p_kind, 'inserted', v_inserted,
    'synced_at', v_synced, 'resolution', v_resolution
  );
end;
$$;

comment on function public.materialize_external_media(text, public.media_kind, text, text, text, text, integer, text, text, numeric, text[], jsonb, text, text) is
  'Trusted server-only canonical materialization of a normalized external catalog record. Resolves a provider identity to a canonical public.media_items row (existing link -> existing provider row -> conservative deterministic title+kind+year candidate -> new row), attaching aliases in public.media_external_ids without ever creating a duplicate for an existing title or overwriting community/user data. Atomic, idempotent, concurrency-safe, collision-safe. SECURITY INVOKER; EXECUTE granted only to service_role. Returns { media_id, slug, source, external_id, kind, inserted, synced_at, resolution } — identifiers + outcome only.';

revoke all on function public.materialize_external_media(text, public.media_kind, text, text, text, text, integer, text, text, numeric, text[], jsonb, text, text) from public;
revoke all on function public.materialize_external_media(text, public.media_kind, text, text, text, text, integer, text, text, numeric, text[], jsonb, text, text) from anon;
revoke all on function public.materialize_external_media(text, public.media_kind, text, text, text, text, integer, text, text, numeric, text[], jsonb, text, text) from authenticated;
grant execute on function public.materialize_external_media(text, public.media_kind, text, text, text, text, integer, text, text, numeric, text[], jsonb, text, text) to service_role;
