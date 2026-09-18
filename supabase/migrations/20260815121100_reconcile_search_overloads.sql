-- Favalog AI Discovery — reconcile search overloads + preserve removal filtering
-- (forward-only corrective migration).
--
-- WHAT WENT WRONG. Migration 20260815120400 established the CANONICAL
-- cutoff-aware retrieval contract:
--   * semantic_search(vector, provider, model, dimensions, document_version,
--                     kind, limit, p_max_distance)                 -- 8 args
--   * hybrid_search(query, vector, provider, model, dimensions,
--                   document_version, kind, limit, p_max_distance)  -- 9 args
-- Migration 20260815121000 then set out to make retrieval REMOVAL-aware, but it
-- recreated the OBSOLETE pre-cutoff overloads instead of the canonical ones:
--   * semantic_search(..., kind, limit)                            -- 7 args
--   * hybrid_search(..., kind, limit)                              -- 8 args
-- adding `provider_removed_at is null` only to those obsolete overloads. Two
-- defects resulted:
--   1. AMBIGUITY. With both the 7-arg and the 8-arg semantic_search present, a
--      call that omits the optional p_max_distance matches BOTH candidates, so
--      PostgreSQL raises 42725 ("function ... is not unique"); same for the
--      8-arg vs 9-arg hybrid_search. The application always passes p_max_distance
--      (so it happened to bind the 9-arg overload), but the pgTAP suite, the
--      evaluation harness, and any cutoff-omitting caller break.
--   2. LOST REMOVAL FILTERING. The removal predicate landed only on the obsolete
--      overloads. The CANONICAL overloads the application actually invokes were
--      left exactly as 20260815120400 created them — WITHOUT removal filtering —
--      so a soft-removed provider row was still discoverable through the real
--      search path, and compatible_embedding_count still counted its embedding.
--
-- WHAT THIS MIGRATION DOES (forward-only; no existing migration is edited).
--   1. Drops the two accidentally-reintroduced obsolete overloads by their EXACT
--      signatures (no CASCADE). Nothing depends on them: no view or function
--      references them, and a function's EXECUTE grants are dropped with it. This
--      leaves exactly one overload of each name, so a cutoff-omitting call is
--      unambiguous again.
--   2. Recreates the CANONICAL cutoff-aware semantic_search (8 args) and
--      hybrid_search (9 args) with `provider_removed_at is null` added to every
--      catalog-scanning arm — merging the cutoff contract (20260815120400) with
--      the removal-awareness intent (20260815121000). All other behaviour is
--      preserved verbatim: provenance guard (provider/model/dimensions/
--      document_version), p_max_distance cutoff BEFORE fusion, exact-title
--      protection, RRF (k=60), [1,50] limit clamp, safe-field-only return
--      columns (never the raw vector or raw distance), SECURITY DEFINER, pinned
--      empty search_path, full schema-qualification, and the anon+authenticated
--      EXECUTE grants.
--   3. Recreates compatible_embedding_count so a soft-removed row's embedding is
--      excluded from the compatible-corpus count, keeping the count consistent
--      with what semantic/hybrid retrieval can actually surface.
--
-- keyword_search already excludes removed rows (added by 20260815121000 on its
-- single, unambiguous 3-arg signature) and is intentionally left untouched here.
--
-- INVARIANT. Removal is a soft, reversible DISCOVERY filter: the media row, its
-- slug, its aliases, its embedding, and every user-owned reference are preserved;
-- a later successful refresh clears provider_removed_at and the row (with its
-- untouched embedding) becomes discoverable again (resurrection).

-- ---------------------------------------------------------------------------
-- 1. Drop the accidentally-reintroduced obsolete overloads (exact signatures).
--    Distinct arg-type lists from the canonical overloads, so these DROPs target
--    ONLY the obsolete functions and never the canonical ones.
-- ---------------------------------------------------------------------------
drop function if exists public.semantic_search(
  extensions.vector, text, text, integer, text, public.media_kind, integer);
drop function if exists public.hybrid_search(
  text, extensions.vector, text, text, integer, text, public.media_kind, integer);

-- ---------------------------------------------------------------------------
-- 2. compatible_embedding_count (provenance + removal aware): count only stored
--    embeddings that carry a complete vector, match the server-supplied identity,
--    AND belong to a row that is NOT soft-removed. Keeps the corpus count aligned
--    with what retrieval can surface. SECURITY DEFINER; returns only a scalar.
-- ---------------------------------------------------------------------------
create or replace function public.compatible_embedding_count(
  p_provider         text,
  p_model            text,
  p_dimensions       integer,
  p_document_version text
)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer
  from public.media_search_documents d
  join public.media_items mi on mi.id = d.media_id
  where d.embedding is not null
    and mi.provider_removed_at is null
    and d.embedding_provider = p_provider
    and d.embedding_model = p_model
    and d.embedding_dimensions = p_dimensions
    and d.document_version = p_document_version
$$;

comment on function public.compatible_embedding_count(text, text, integer, text) is
  'Count of stored embeddings that carry a complete vector, match the server-supplied embedding identity (provider/model/dimensions/document_version), AND belong to a row that is not soft-removed (provider_removed_at is null). SECURITY DEFINER, pinned empty search_path, read-only; returns only a scalar count (never a vector). Lets the application avoid a query embedding and stay keyword-only when no compatible, discoverable semantic corpus exists.';

-- ---------------------------------------------------------------------------
-- 3. semantic_search (canonical: provenance guard + relevance cutoff + removal
--    awareness). Recreated with `provider_removed_at is null` added to the
--    catalog scan; everything else is identical to 20260815120400.
-- ---------------------------------------------------------------------------
create or replace function public.semantic_search(
  p_query_embedding  extensions.vector(512),
  p_provider         text,
  p_model            text,
  p_dimensions       integer,
  p_document_version text,
  p_kind             public.media_kind default null,
  p_limit            integer default 24,
  p_max_distance     real default null
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
    and (
      p_max_distance is null
      or (d.embedding operator(extensions.<=>) p_query_embedding) <= p_max_distance
    )
  order by
    d.embedding operator(extensions.<=>) p_query_embedding asc,
    mi.id
  limit least(greatest(coalesce(p_limit, 24), 1), 50)
$$;

comment on function public.semantic_search(extensions.vector, text, text, integer, text, public.media_kind, integer, real) is
  'Provenance-guarded cosine nearest-neighbour retrieval over the PRIVATE media_search_documents table, with an optional SERVER-supplied cosine-distance relevance cutoff (p_max_distance; null = no cutoff). Only rows whose stored provider/model/dimensions/document_version match the server-supplied expected identity (never client input), whose distance is within the cutoff, AND that are not soft-removed (provider_removed_at is null) participate. SECURITY DEFINER, pinned empty search_path, read-only. Returns only safe catalog fields + a distance-derived rank (never the raw vector or raw distance); result count clamped to [1,50].';

-- ---------------------------------------------------------------------------
-- 4. hybrid_search (canonical: RRF k=60 of lexical + provenance-guarded,
--    cutoff-filtered semantic arm, exact-title protection). Recreated with
--    `provider_removed_at is null` in BOTH the lexical and semantic arms; a
--    removed row therefore never enters fusion (so it cannot resurface through
--    the outer join either). Everything else is identical to 20260815120400.
-- ---------------------------------------------------------------------------
create or replace function public.hybrid_search(
  p_query            text,
  p_query_embedding  extensions.vector(512),
  p_provider         text,
  p_model            text,
  p_dimensions       integer,
  p_document_version text,
  p_kind             public.media_kind default null,
  p_limit            integer default 24,
  p_max_distance     real default null
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
      and (
        p_max_distance is null
        or (d.embedding operator(extensions.<=>) p_query_embedding) <= p_max_distance
      )
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

comment on function public.hybrid_search(text, extensions.vector, text, text, integer, text, public.media_kind, integer, real) is
  'Provenance-guarded hybrid catalog retrieval: reciprocal-rank fusion (k=60) of the lexical arm (media_items FTS) and the provenance-guarded semantic arm, with an optional SERVER-supplied cosine-distance relevance cutoff (p_max_distance; null = no cutoff) applied to the semantic candidates BEFORE fusion, plus exact-title protection. Soft-removed rows (provider_removed_at is not null) are excluded from BOTH arms, so they never enter fusion. When every semantic candidate is filtered out, results degrade to the lexical ranking. SECURITY DEFINER (reads the private embedding table), pinned empty search_path, read-only, no dynamic SQL. Returns only safe catalog fields + a fused rank; result count clamped to [1,50].';

-- ---------------------------------------------------------------------------
-- 5. Restate privileges on the reconciled canonical overloads (create-or-replace
--    preserves grants; restated here so the security posture is explicit and
--    self-contained). Revoke from public; grant execute to the Data API roles.
-- ---------------------------------------------------------------------------
revoke all on function public.compatible_embedding_count(text, text, integer, text) from public;
grant execute on function public.compatible_embedding_count(text, text, integer, text) to anon;
grant execute on function public.compatible_embedding_count(text, text, integer, text) to authenticated;

revoke all on function public.semantic_search(extensions.vector, text, text, integer, text, public.media_kind, integer, real) from public;
grant execute on function public.semantic_search(extensions.vector, text, text, integer, text, public.media_kind, integer, real) to anon;
grant execute on function public.semantic_search(extensions.vector, text, text, integer, text, public.media_kind, integer, real) to authenticated;

revoke all on function public.hybrid_search(text, extensions.vector, text, text, integer, text, public.media_kind, integer, real) from public;
grant execute on function public.hybrid_search(text, extensions.vector, text, text, integer, text, public.media_kind, integer, real) to anon;
grant execute on function public.hybrid_search(text, extensions.vector, text, text, integer, text, public.media_kind, integer, real) to authenticated;
