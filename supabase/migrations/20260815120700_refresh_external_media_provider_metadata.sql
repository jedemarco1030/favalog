-- Favalog Catalog Platform v1B follow-up: make a re-import of an ALREADY-LINKED
-- provider identity perform a genuine provider metadata refresh.
--
-- BUG (migration 20260815120600): the first resolution branch of
-- public.materialize_external_media — an existing row reached via the
-- media_external_ids alias — refreshed subtitle / synopsis / poster / backdrop
-- and rewrote content_hash / normalization_version / synced_at, but did NOT
-- update year, genres, or details. Consequences for a provider-owned row:
--   * re-importing reported success ('existing');
--   * provenance (content_hash / normalization_version) advanced to describe the
--     NEWLY normalized payload;
--   * the stored genres / year / details stayed STALE.
-- So the Phase 4A.1 canonical genre cleanup never actually reached an
-- already-imported Open Library row: browse kept exposing raw subjects, and
-- provenance temporarily lied about the stored content.
--
-- FIX (forward-only; the prior migration is NOT edited): recreate the function
-- with the SAME signature and the SAME security posture (SECURITY INVOKER,
-- pinned empty search_path, fully schema-qualified, service_role-only EXECUTE,
-- identifier-only return, advisory locking, idempotency, ambiguity/duplicate
-- protection). The only behavioural change is the existing-identity refresh:
--
--   * The alias branch and the "existing provider row without an alias" branch
--     now share ONE audited UPDATE. That single statement expresses the whole
--     provider-metadata policy with a per-column CASE keyed on whether the
--     resolved row is PROVIDER-OWNED (media_items.source = p_source):
--       - provider-owned row  -> a genuine, full refresh of every
--         provider-controlled field (subtitle, synopsis, year, poster,
--         backdrop, provider rating, canonical genres, kind-specific details)
--         together with content_hash / normalization_version / synced_at, so
--         provenance and the stored metadata always advance ATOMICALLY and can
--         never disagree;
--       - curated (source='favalog') row reached via a canonical alias -> the
--         conservative link policy is retained UNCHANGED: never overwrite the
--         curated title / year / genres / details / community average_rating;
--         only fill genuinely EMPTY presentation fields and only stamp
--         content_hash / normalization_version when they are still empty.
--
-- Preserved for BOTH kinds of row: media id, immutable slug, the
-- media_external_ids alias, and all user/community data (diary entries, reviews,
-- favorites, list memberships, community rating on curated rows). The conservative
-- deterministic candidate branch (3) and the new-row branch (4) are byte-for-byte
-- the same policy as before.

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

comment on function public.materialize_external_media(text, public.media_kind, text, text, text, text, integer, text, text, numeric, text[], jsonb, text, text) is
  'Trusted server-only canonical materialization of a normalized external catalog record. Resolves a provider identity to a canonical public.media_items row (existing link -> existing provider row -> conservative deterministic title+kind+year candidate -> new row), attaching aliases in public.media_external_ids without ever creating a duplicate for an existing title or overwriting community/user data. Re-importing an already-linked PROVIDER-OWNED row performs a genuine full metadata refresh (subtitle/synopsis/year/poster/backdrop/rating/genres/details) atomically with its provenance (content_hash/normalization_version/synced_at); a curated favalog row reached via a canonical alias keeps the conservative fill-empty policy. Atomic, idempotent, concurrency-safe, collision-safe. SECURITY INVOKER; EXECUTE granted only to service_role. Returns { media_id, slug, source, external_id, kind, inserted, synced_at, resolution } — identifiers + outcome only.';

-- Re-assert least-privilege EXECUTE (create-or-replace preserves grants, but we
-- restate them so the security posture is explicit and self-contained here).
revoke all on function public.materialize_external_media(text, public.media_kind, text, text, text, text, integer, text, text, numeric, text[], jsonb, text, text) from public;
revoke all on function public.materialize_external_media(text, public.media_kind, text, text, text, text, integer, text, text, numeric, text[], jsonb, text, text) from anon;
revoke all on function public.materialize_external_media(text, public.media_kind, text, text, text, text, integer, text, text, numeric, text[], jsonb, text, text) from authenticated;
grant execute on function public.materialize_external_media(text, public.media_kind, text, text, text, text, integer, text, text, numeric, text[], jsonb, text, text) to service_role;
