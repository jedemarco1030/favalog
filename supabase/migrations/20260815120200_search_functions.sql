-- Favalog AI Discovery v1 (3/3): the retrieval functions.
--
-- Three set-returning functions expose search WITHOUT exposing the private
-- embedding store or any raw vector:
--
--   * keyword_search  — deterministic lexical retrieval over the public catalog
--                       FTS index. Reads only public.media_items, so it is
--                       SECURITY INVOKER. This is the keyword-only fallback and
--                       works with zero embeddings / no OpenAI key.
--   * semantic_search — nearest-neighbour over the private embedding table.
--   * hybrid_search   — reciprocal-rank fusion of the keyword and semantic arms
--                       with exact-title protection.
--
-- SECURITY DEFINER EXCEPTION (semantic_search, hybrid_search): these must read
-- the PRIVATE public.media_search_documents table, which has no anon/authenticated
-- grants and RLS with no policies. Rather than exposing that table (and its raw
-- vectors) to the Data API, read access is confined to these two functions,
-- hardened as follows:
--   * SECURITY DEFINER owned by the migration role (bypasses RLS to read the
--     private table) BUT they only ever SELECT and only ever RETURN safe catalog
--     fields + ranking metadata — never the embedding vector.
--   * search_path pinned to '' and every non-builtin object fully schema-
--     qualified (public.*, extensions.*, the extensions.<=> operator).
--   * No dynamic SQL anywhere; untrusted text goes only through
--     websearch_to_tsquery (never string-interpolated into SQL).
--   * Strict, clamped result limits; STABLE + read-only (no writes).
--   * EXECUTE revoked from public and granted only to anon + authenticated so
--     public Explore search works while nothing else can invoke them.
--
-- All three return the same safe shape (safe catalog columns + a `rank` scalar).
-- `rank` is ranking metadata for the server; the UI never renders raw scores.

-- Shared clamp: coalesce → floor into [1, 50]. Inlined per function (SQL has no
-- shared local); the ceiling matches the app-side MAX_RESULT_LIMIT.

-- ---------------------------------------------------------------------------
-- keyword_search: deterministic lexical retrieval (SECURITY INVOKER).
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
  'Deterministic lexical catalog retrieval over media_items.search_tsv (SECURITY INVOKER). Exact-title matches sort first. Untrusted text is parsed with websearch_to_tsquery (never interpolated). Returns safe catalog fields + a ts_rank_cd rank; result count clamped to [1,50]. Works with zero embeddings (the keyword-only fallback).';

-- ---------------------------------------------------------------------------
-- semantic_search: nearest-neighbour over the private embedding table
-- (SECURITY DEFINER — justified above).
-- ---------------------------------------------------------------------------
create or replace function public.semantic_search(
  p_query_embedding extensions.vector(512),
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
    and (p_kind is null or mi.kind = p_kind)
  order by
    d.embedding operator(extensions.<=>) p_query_embedding asc,
    mi.id
  limit least(greatest(coalesce(p_limit, 24), 1), 50)
$$;

comment on function public.semantic_search(extensions.vector, public.media_kind, integer) is
  'Cosine nearest-neighbour retrieval over the PRIVATE media_search_documents table (SECURITY DEFINER, pinned empty search_path, read-only). The trusted query embedding is generated server-side by the application. Returns only safe catalog fields + a distance-derived rank — never the raw vector; result count clamped to [1,50].';

-- ---------------------------------------------------------------------------
-- hybrid_search: reciprocal-rank fusion + exact-title protection
-- (SECURITY DEFINER — reads the private table for the semantic arm).
-- ---------------------------------------------------------------------------
create or replace function public.hybrid_search(
  p_query           text,
  p_query_embedding extensions.vector(512),
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

comment on function public.hybrid_search(text, extensions.vector, public.media_kind, integer) is
  'Hybrid catalog retrieval: reciprocal-rank fusion (k=60) of the lexical arm (media_items FTS) and the semantic arm (private embeddings), with exact-title protection so a direct title query is never demoted. SECURITY DEFINER (reads the private embedding table), pinned empty search_path, read-only, no dynamic SQL. Returns only safe catalog fields + a fused rank; result count clamped to [1,50].';

-- ---------------------------------------------------------------------------
-- Privileges: revoke from public, grant execute to the Data API roles so
-- (anonymous + authenticated) Explore search works. Nothing else can invoke.
-- ---------------------------------------------------------------------------
revoke all on function public.keyword_search(text, public.media_kind, integer) from public;
grant execute on function public.keyword_search(text, public.media_kind, integer) to anon;
grant execute on function public.keyword_search(text, public.media_kind, integer) to authenticated;

revoke all on function public.semantic_search(extensions.vector, public.media_kind, integer) from public;
grant execute on function public.semantic_search(extensions.vector, public.media_kind, integer) to anon;
grant execute on function public.semantic_search(extensions.vector, public.media_kind, integer) to authenticated;

revoke all on function public.hybrid_search(text, extensions.vector, public.media_kind, integer) from public;
grant execute on function public.hybrid_search(text, extensions.vector, public.media_kind, integer) to anon;
grant execute on function public.hybrid_search(text, extensions.vector, public.media_kind, integer) to authenticated;
