-- Favalog Phase 4C.1: RAWG provider identity + personal game status (forward-only).
--
-- Depends on 20260925120000_media_kind_game.sql, which added 'game' to
-- public.media_kind in its own (committed) transaction.
--
-- WHAT IT DOES.
--   1. Admits 'rawg' as a canonical external provider identity in
--      public.media_external_ids.
--   2. Re-creates the four trusted, service_role-only catalog RPCs with their
--      provider allowlist widened from ('tmdb','openlibrary') to include 'rawg'.
--      The function bodies are otherwise identical to the latest definitions
--      (materialize_external_media from 20260815120700; the three refresh
--      lifecycle functions from 20260815121000). Signatures are unchanged, so
--      CREATE OR REPLACE preserves the existing EXECUTE grants/revokes and
--      comments; no browser role gains access.
--   3. Adds public.game_statuses: a minimal, owner-only personal play status
--      (backlog / playing / completed / paused / dropped). It is deliberately
--      DISTINCT from diary entries (historical log) and from ratings: rating a
--      game never implies completing it, and nothing here derives one from the
--      other.
--
-- NOT IN SCOPE: playtime sync, achievements, console-account linking, and
-- edition/DLC tracking.

-- ---------------------------------------------------------------------------
-- 1. Provider identity.
-- ---------------------------------------------------------------------------
alter table public.media_external_ids
  drop constraint if exists media_external_ids_provider_check;
alter table public.media_external_ids
  add constraint media_external_ids_provider_check
    check (provider in ('tmdb', 'openlibrary', 'rawg'));

comment on table public.media_external_ids is
  'Canonical external identity aliases: links a canonical public.media_items row to provider (TMDB / Open Library / RAWG) identities. The single authority for de-duplicating an external result to an existing Favalog title. Publicly readable (identity only); writes are restricted to the trusted server-side process via materialize_external_media.';

-- ---------------------------------------------------------------------------
-- 2. Trusted catalog RPCs with the widened provider allowlist.
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
  v_backfill   boolean := false;
begin
  -- Identity + core field validation (mirrors materialize_media_item so both
  -- write paths reject the same malformed input with the same mapped errors).
  if v_source not in ('tmdb', 'openlibrary', 'rawg') then
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

  -- (1)/(2) Resolve an EXISTING canonical row for this identity:
  --   (1) an exact existing provider link in media_external_ids, else
  --   (2) an exact existing provider row (materialized before the alias existed,
  --       or via v1A's materialize_media_item) whose alias we then backfill.
  select l.media_id into v_media_id
  from public.media_external_ids l
  where l.provider = v_source and l.kind = p_kind and l.external_id = v_ext;

  if v_media_id is null then
    select m.id into v_media_id
    from public.media_items m
    where m.source = v_source and m.external_id = v_ext;
    if v_media_id is not null then
      v_backfill := true;
    end if;
  end if;

  if v_media_id is not null then
    -- ONE audited UPDATE expressing the whole provider-metadata policy. The
    -- per-column CASE keys on whether the resolved row is PROVIDER-OWNED
    -- (m.source = v_source):
    --   * provider-owned -> a genuine full refresh of every provider-controlled
    --     field, so genres/year/details advance ATOMICALLY with the provenance
    --     columns (content_hash / normalization_version) that describe them;
    --   * curated (favalog) row reached via a canonical alias -> the
    --     conservative link policy: never overwrite curated
    --     title/year/genres/details/community rating; fill only genuinely EMPTY
    --     presentation fields and stamp provenance only when still empty.
    update public.media_items m set
      subtitle = case
        when m.source = v_source then nullif(btrim(coalesce(p_subtitle, '')), '')
        else coalesce(m.subtitle, nullif(btrim(coalesce(p_subtitle, '')), ''))
      end,
      synopsis = case
        when m.source = v_source then coalesce(p_synopsis, '')
        when coalesce(m.synopsis, '') = '' then coalesce(p_synopsis, '')
        else m.synopsis
      end,
      year = case
        when m.source = v_source then p_year
        else m.year
      end,
      poster_url = case
        when m.source = v_source then nullif(btrim(coalesce(p_poster_url, '')), '')
        else coalesce(m.poster_url, nullif(btrim(coalesce(p_poster_url, '')), ''))
      end,
      backdrop_url = case
        when m.source = v_source then nullif(btrim(coalesce(p_backdrop_url, '')), '')
        else coalesce(m.backdrop_url, nullif(btrim(coalesce(p_backdrop_url, '')), ''))
      end,
      average_rating = case
        when m.source = v_source then p_average_rating
        else m.average_rating
      end,
      genres = case
        when m.source = v_source then coalesce(p_genres, '{}')
        else m.genres
      end,
      details = case
        when m.source = v_source then coalesce(p_details, '{}'::jsonb)
        else m.details
      end,
      content_hash = case
        when m.source = v_source then p_content_hash
        else coalesce(m.content_hash, p_content_hash)
      end,
      normalization_version = case
        when m.source = v_source then v_version
        else coalesce(m.normalization_version, v_version)
      end,
      synced_at = v_synced,
      updated_at = now()
    where m.id = v_media_id
    returning m.slug into v_slug_out;

    -- Backfill the alias for a pre-existing provider row (idempotent).
    if v_backfill then
      insert into public.media_external_ids (media_id, provider, kind, external_id)
      values (v_media_id, v_source, p_kind, v_ext)
      on conflict (provider, kind, external_id) do nothing;
    end if;

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
  if v_source not in ('tmdb', 'openlibrary', 'rawg') then
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
  if v_source not in ('tmdb', 'openlibrary', 'rawg') then
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
  if v_source not in ('tmdb', 'openlibrary', 'rawg') then
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

-- ---------------------------------------------------------------------------
-- 3. Personal game status.
-- ---------------------------------------------------------------------------
create type public.game_play_status as enum
  ('backlog', 'playing', 'completed', 'paused', 'dropped');

create table public.game_statuses (
  user_id    uuid not null references public.profiles (id) on delete cascade,
  media_id   uuid not null references public.media_items (id) on delete cascade,
  status     public.game_play_status not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, media_id)
);

comment on table public.game_statuses is
  'Owner-only personal play status for a game (backlog/playing/completed/paused/dropped). Distinct from diary entries and ratings; never inferred from either. One row per (user, game).';

create index game_statuses_media_id_idx on public.game_statuses (media_id);

create trigger game_statuses_set_updated_at
  before update on public.game_statuses
  for each row execute function public.set_updated_at();

-- A status may only ever attach to a game. Enforced in the database (not just
-- the UI) so a crafted request cannot mark a film "completed" through this
-- table. SECURITY INVOKER is sufficient: media_items is publicly readable.
create or replace function public.game_statuses_require_game()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.media_items m
    where m.id = new.media_id and m.kind = 'game'::public.media_kind
  ) then
    raise exception 'status applies only to games'
      using errcode = '22023';
  end if;
  return new;
end;
$$;

create trigger game_statuses_require_game
  before insert or update of media_id on public.game_statuses
  for each row execute function public.game_statuses_require_game();

alter table public.game_statuses enable row level security;

-- Owner-only in every direction. Status is a personal tracking hint, not a
-- social surface, so no public/follower read policy exists in this phase.
create policy "game_statuses_select_own"
  on public.game_statuses for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "game_statuses_insert_own"
  on public.game_statuses for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "game_statuses_update_own"
  on public.game_statuses for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "game_statuses_delete_own"
  on public.game_statuses for delete to authenticated
  using ((select auth.uid()) = user_id);

-- Explicit table privileges (the project does not auto-expose new tables; see
-- 20260806160000_grant_table_privileges.sql). anon gets nothing.
grant select, insert, update, delete on table public.game_statuses to authenticated;
grant select, insert, update, delete on table public.game_statuses to service_role;
