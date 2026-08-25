-- Favalog AI Discovery v1 — semantic relevance cutoff (forward-only).
--
-- CORRECTNESS FIX: the provenance-guarded semantic_search / hybrid_search
-- functions (migration 20260815120300) returned the cosine-nearest stored
-- vectors unconditionally — nearest-neighbour search ALWAYS returns something,
-- even when nothing is genuinely relevant. An out-of-domain or nonsense query
-- ("zombie apocalypse", "asdf qwerty", a film we do not carry) would therefore
-- still surface a confident-looking-but-wrong semantic hit, and (via fusion) a
-- confident hybrid result.
--
-- This migration adds a SERVER-CONTROLLED semantic relevance cutoff: an optional
-- maximum cosine DISTANCE (`p_max_distance`) that a stored vector may have from
-- the query embedding to still be considered a semantic candidate. It is applied
-- BEFORE the semantic candidates enter reciprocal-rank fusion, so an irrelevant
-- neighbour never contributes to the ranking and the semantic arm can correctly
-- return nothing. pgvector's `<=>` cosine distance is `1 - cosineSimilarity` for
-- the unit vectors we store, so the cutoff is equivalently a MINIMUM similarity.
--
-- The value is supplied by the application (lib/search/config.ts
-- SEMANTIC_MAX_COSINE_DISTANCE, passed through lib/supabase/search.ts and the
-- evaluation harness) — never by the browser. `p_max_distance` DEFAULTS to null
-- (no cutoff) so the change is backward-compatible for any positional caller.
--
-- Keyword retrieval and exact-title protection are UNCHANGED: an exact-title
-- match is a lexical hit and is never removed by the semantic cutoff. When the
-- semantic arm is fully filtered out, hybrid_search degrades to the lexical
-- (keyword) ranking, exactly like the keyword-only fallback path.
--
-- SECURITY POSTURE (unchanged from 20260815120300, re-applied to the new
-- overloads): semantic_search / hybrid_search are SECURITY DEFINER — the narrow,
-- justified exception that reads the PRIVATE public.media_search_documents table
-- — hardened with a pinned empty search_path, full schema-qualification, no
-- dynamic SQL, clamped read-only limits, safe-field-only returns (never the raw
-- vector or the raw distance), EXECUTE revoked from public and granted only to
-- anon + authenticated. compatible_embedding_count is unchanged.

-- ---------------------------------------------------------------------------
-- Remove the previous (cutoff-less) provenance-guarded overloads so nothing can
-- invoke a semantic search without the cutoff contract.
-- ---------------------------------------------------------------------------
drop function if exists public.semantic_search(
  extensions.vector, text, text, integer, text, public.media_kind, integer);
drop function if exists public.hybrid_search(
  text, extensions.vector, text, text, integer, text, public.media_kind, integer);

-- ---------------------------------------------------------------------------
-- semantic_search (provenance-guarded + relevance cutoff): nearest-neighbour
-- over the private embedding table, restricted to rows in the SAME embedding
-- space as the query AND within the optional cosine-distance cutoff.
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
  'Provenance-guarded cosine nearest-neighbour retrieval over the PRIVATE media_search_documents table, with an optional SERVER-supplied cosine-distance relevance cutoff (p_max_distance; null = no cutoff). Only rows whose stored provider/model/dimensions/document_version match the server-supplied expected identity (never client input) AND whose distance is within the cutoff participate. SECURITY DEFINER, pinned empty search_path, read-only. Returns only safe catalog fields + a distance-derived rank (never the raw vector or raw distance); result count clamped to [1,50].';

-- ---------------------------------------------------------------------------
-- hybrid_search (provenance-guarded + relevance cutoff): RRF (k=60) of the
-- lexical arm and the provenance-guarded + cutoff-filtered semantic arm, with
-- exact-title protection. The cutoff is applied to the semantic candidates
-- BEFORE fusion, so an irrelevant neighbour never contributes a fused score.
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
  'Provenance-guarded hybrid catalog retrieval: reciprocal-rank fusion (k=60) of the lexical arm (media_items FTS) and the provenance-guarded semantic arm, with an optional SERVER-supplied cosine-distance relevance cutoff (p_max_distance; null = no cutoff) applied to the semantic candidates BEFORE fusion, plus exact-title protection. When every semantic candidate is filtered out, results degrade to the lexical ranking. SECURITY DEFINER (reads the private embedding table), pinned empty search_path, read-only, no dynamic SQL. Returns only safe catalog fields + a fused rank; result count clamped to [1,50].';

-- ---------------------------------------------------------------------------
-- Privileges: revoke from public, grant execute to the Data API roles so
-- (anonymous + authenticated) Explore search works. Nothing else can invoke.
-- ---------------------------------------------------------------------------
revoke all on function public.semantic_search(extensions.vector, text, text, integer, text, public.media_kind, integer, real) from public;
grant execute on function public.semantic_search(extensions.vector, text, text, integer, text, public.media_kind, integer, real) to anon;
grant execute on function public.semantic_search(extensions.vector, text, text, integer, text, public.media_kind, integer, real) to authenticated;

revoke all on function public.hybrid_search(text, extensions.vector, text, text, integer, text, public.media_kind, integer, real) from public;
grant execute on function public.hybrid_search(text, extensions.vector, text, text, integer, text, public.media_kind, integer, real) to anon;
grant execute on function public.hybrid_search(text, extensions.vector, text, text, integer, text, public.media_kind, integer, real) to authenticated;
