-- Favalog AI Discovery v1 — provenance-guarded semantic retrieval (forward-only).
--
-- CORRECTNESS FIX: the original semantic_search / hybrid_search functions
-- (migration 20260815120200) matched the query embedding against EVERY non-null
-- stored vector, without confirming that the stored vector belongs to the same
-- embedding space as the query. A corpus embedded with one identity (e.g. the
-- deterministic FAKE provider, or an old model/dimension/document version) would
-- therefore be searched with a query embedding produced by a different identity
-- (e.g. a real OpenAI run) — comparing vectors that are not comparable.
--
-- This migration makes the embedding IDENTITY part of the semantic contract:
-- the SERVER (never the browser) supplies the expected provider, model,
-- dimensions, and document version, and the semantic arm only ever considers
-- rows whose stored provenance matches all four (and that carry a complete
-- embedding). It also adds a cheap compatible-corpus counter so the application
-- can fall back to keyword-only — and avoid paying for a query embedding —
-- whenever no compatible semantic corpus exists.
--
-- The OLD, unguarded semantic_search / hybrid_search overloads are DROPPED so
-- nothing can invoke an unguarded semantic search any more. keyword_search is
-- unchanged (deterministic lexical retrieval, SECURITY INVOKER, the fallback).
--
-- SECURITY POSTURE (unchanged from 20260815120200, re-applied to the new
-- overloads): semantic_search / hybrid_search / compatible_embedding_count are
-- SECURITY DEFINER — the narrow, justified exception that reads the PRIVATE
-- public.media_search_documents table — hardened with a pinned empty
-- search_path, full schema-qualification, no dynamic SQL, clamped read-only
-- limits, safe-field-only returns (never the raw vector), EXECUTE revoked from
-- public and granted only to anon + authenticated so anonymous + authenticated
-- Explore search keeps working. Exact-title protection and RRF (k=60) are
-- preserved.

-- ---------------------------------------------------------------------------
-- Remove the unguarded overloads so they can never be invoked again.
-- ---------------------------------------------------------------------------
drop function if exists
  public.semantic_search(extensions.vector, public.media_kind, integer);
drop function if exists
  public.hybrid_search(text, extensions.vector, public.media_kind, integer);

-- ---------------------------------------------------------------------------
-- compatible_embedding_count: how many stored embeddings match the server's
-- expected identity (provider/model/dimensions/document version) AND carry a
-- complete vector. Lets the app skip the paid query embedding and stay
-- keyword-only when the compatible semantic corpus is missing/partial/stale.
-- SECURITY DEFINER (reads the private table) but returns only a scalar count.
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
  where d.embedding is not null
    and d.embedding_provider = p_provider
    and d.embedding_model = p_model
    and d.embedding_dimensions = p_dimensions
    and d.document_version = p_document_version
$$;

comment on function public.compatible_embedding_count(text, text, integer, text) is
  'Count of stored embeddings that carry a complete vector AND match the server-supplied embedding identity (provider/model/dimensions/document_version). SECURITY DEFINER, pinned empty search_path, read-only; returns only a scalar count (never a vector). Lets the application avoid a query embedding and stay keyword-only when no compatible semantic corpus exists.';

-- ---------------------------------------------------------------------------
-- semantic_search (provenance-guarded): nearest-neighbour over the private
-- embedding table, restricted to rows in the SAME embedding space as the query.
-- ---------------------------------------------------------------------------
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
  'Provenance-guarded cosine nearest-neighbour retrieval over the PRIVATE media_search_documents table. Only rows whose stored provider/model/dimensions/document_version match the SERVER-supplied expected identity (never client input) — i.e. the same embedding space as the query — participate. SECURITY DEFINER, pinned empty search_path, read-only. Returns only safe catalog fields + a distance-derived rank (never the raw vector); result count clamped to [1,50].';

-- ---------------------------------------------------------------------------
-- hybrid_search (provenance-guarded): RRF (k=60) of the lexical arm and the
-- provenance-guarded semantic arm, with exact-title protection.
-- ---------------------------------------------------------------------------
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
  'Provenance-guarded hybrid catalog retrieval: reciprocal-rank fusion (k=60) of the lexical arm (media_items FTS) and the provenance-guarded semantic arm (only rows matching the SERVER-supplied provider/model/dimensions/document_version), with exact-title protection. SECURITY DEFINER (reads the private embedding table), pinned empty search_path, read-only, no dynamic SQL. Returns only safe catalog fields + a fused rank; result count clamped to [1,50].';

-- ---------------------------------------------------------------------------
-- Privileges: revoke from public, grant execute to the Data API roles so
-- (anonymous + authenticated) Explore search works. Nothing else can invoke.
-- ---------------------------------------------------------------------------
revoke all on function public.compatible_embedding_count(text, text, integer, text) from public;
grant execute on function public.compatible_embedding_count(text, text, integer, text) to anon;
grant execute on function public.compatible_embedding_count(text, text, integer, text) to authenticated;

revoke all on function public.semantic_search(extensions.vector, text, text, integer, text, public.media_kind, integer) from public;
grant execute on function public.semantic_search(extensions.vector, text, text, integer, text, public.media_kind, integer) to anon;
grant execute on function public.semantic_search(extensions.vector, text, text, integer, text, public.media_kind, integer) to authenticated;

revoke all on function public.hybrid_search(text, extensions.vector, text, text, integer, text, public.media_kind, integer) from public;
grant execute on function public.hybrid_search(text, extensions.vector, text, text, integer, text, public.media_kind, integer) to anon;
grant execute on function public.hybrid_search(text, extensions.vector, text, text, integer, text, public.media_kind, integer) to authenticated;
