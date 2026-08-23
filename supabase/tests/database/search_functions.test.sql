-- pgTAP: Favalog AI Discovery search layer — the private embedding store
-- (public.media_search_documents), the media_items FTS index, and the three
-- retrieval functions (keyword_search / semantic_search / hybrid_search).
--
-- Asserts real schema behavior — pgvector install, table shape + constraints,
-- FK cascade, execution grants + security configuration (SECURITY INVOKER vs
-- DEFINER, pinned empty search_path), that ordinary roles can never read the
-- raw vectors, and the deterministic ranking / clamping / filtering behavior of
-- the three functions (including exact-title protection and RRF fusion).
--
-- Self-contained: resolves catalog titles by the stable slugs installed by the
-- catalog migrations (20260806160100 + 20260815120000), seeds two deterministic
-- embeddings as the default (superuser) pgTAP role, and rolls everything back.
-- Does NOT depend on seed.sql.
--
-- Run with the local stack: `npm run db:test` (requires Docker + Supabase CLI).

begin;
select plan(47);

-- ---------------------------------------------------------------------------
-- 1. Extension: pgvector installed, and living in the `extensions` schema.
-- ---------------------------------------------------------------------------
select ok(
  (select count(*)::int from pg_extension where extname = 'vector') = 1,
  'the vector (pgvector) extension is installed');
select is(
  (select n.nspname
     from pg_extension e
     join pg_namespace n on n.oid = e.extnamespace
    where e.extname = 'vector'),
  'extensions',
  'the vector extension lives in the extensions schema');

-- ---------------------------------------------------------------------------
-- 2. Table shape + CHECK constraints.
-- ---------------------------------------------------------------------------
select has_table('public', 'media_search_documents',
  'the private embedding store table exists');
select has_column('public', 'media_search_documents', 'media_id',
  'media_search_documents has media_id (PK/FK)');
select has_column('public', 'media_search_documents', 'content',
  'media_search_documents has content');
select has_column('public', 'media_search_documents', 'content_hash',
  'media_search_documents has content_hash');
select has_column('public', 'media_search_documents', 'embedding',
  'media_search_documents has embedding');
select has_column('public', 'media_search_documents', 'embedding_model',
  'media_search_documents has embedding_model');
select has_column('public', 'media_search_documents', 'embedding_dimensions',
  'media_search_documents has embedding_dimensions');

-- content_hash must be a 64-char lowercase hex SHA-256.
select throws_ok(
  $$ insert into public.media_search_documents (media_id, content, content_hash)
     values ((select id from public.media_items where slug = 'dune-part-two'),
             'x', 'NOT-A-VALID-HASH') $$,
  '23514', null,
  'a non-hex content_hash is rejected by the format CHECK');

-- embedding_dimensions is null or exactly 512.
select throws_ok(
  $$ insert into public.media_search_documents
       (media_id, content, content_hash, embedding, embedding_model,
        embedding_provider, embedding_dimensions, embedded_at)
     values ((select id from public.media_items where slug = 'dune-part-two'),
             'x', repeat('a', 64),
             ('[1' || repeat(',0', 511) || ']')::extensions.vector,
             'fake', 'fake', 256, now()) $$,
  '23514', null,
  'an embedding_dimensions other than 512 is rejected');

-- Embedding provenance is all-or-nothing: a vector with a null model fails.
select throws_ok(
  $$ insert into public.media_search_documents
       (media_id, content, content_hash, embedding, embedding_model,
        embedding_provider, embedding_dimensions, embedded_at)
     values ((select id from public.media_items where slug = 'dune-part-two'),
             'x', repeat('a', 64),
             ('[1' || repeat(',0', 511) || ']')::extensions.vector,
             null, 'fake', 512, now()) $$,
  '23514', null,
  'a partially-embedded row (vector set, model null) violates provenance');

-- ---------------------------------------------------------------------------
-- 3. Referential integrity: FK + ON DELETE CASCADE.
-- ---------------------------------------------------------------------------
select throws_ok(
  $$ insert into public.media_search_documents (media_id, content, content_hash)
     values ('00000000-0000-0000-0000-0000000000fe', 'x', repeat('c', 64)) $$,
  '23503', null,
  'a document for a non-existent media_id violates the FK');

-- Insert a document for a real title, delete that media row, assert cascade.
insert into public.media_search_documents (media_id, content, content_hash)
select id, 'x', repeat('b', 64)
  from public.media_items where slug = 'low-country';
delete from public.media_items where slug = 'low-country';
select is(
  (select count(*)::int from public.media_search_documents
    where content_hash = repeat('b', 64)),
  0,
  'deleting a media_items row cascade-deletes its search document');

-- ---------------------------------------------------------------------------
-- 4. Execution grants + security configuration.
-- ---------------------------------------------------------------------------
-- keyword_search: SECURITY INVOKER, anon + authenticated, NOT public.
select ok(
  has_function_privilege('anon',
    'public.keyword_search(text, public.media_kind, integer)', 'execute'),
  'anon may execute keyword_search');
select ok(
  has_function_privilege('authenticated',
    'public.keyword_search(text, public.media_kind, integer)', 'execute'),
  'authenticated may execute keyword_search');
select ok(
  not has_function_privilege('public',
    'public.keyword_search(text, public.media_kind, integer)', 'execute'),
  'public may not execute keyword_search');

-- semantic_search: SECURITY DEFINER, anon + authenticated, NOT public.
select ok(
  has_function_privilege('anon',
    'public.semantic_search(extensions.vector, public.media_kind, integer)', 'execute'),
  'anon may execute semantic_search');
select ok(
  has_function_privilege('authenticated',
    'public.semantic_search(extensions.vector, public.media_kind, integer)', 'execute'),
  'authenticated may execute semantic_search');
select ok(
  not has_function_privilege('public',
    'public.semantic_search(extensions.vector, public.media_kind, integer)', 'execute'),
  'public may not execute semantic_search');

-- hybrid_search: SECURITY DEFINER, anon + authenticated, NOT public.
select ok(
  has_function_privilege('anon',
    'public.hybrid_search(text, extensions.vector, public.media_kind, integer)', 'execute'),
  'anon may execute hybrid_search');
select ok(
  has_function_privilege('authenticated',
    'public.hybrid_search(text, extensions.vector, public.media_kind, integer)', 'execute'),
  'authenticated may execute hybrid_search');
select ok(
  not has_function_privilege('public',
    'public.hybrid_search(text, extensions.vector, public.media_kind, integer)', 'execute'),
  'public may not execute hybrid_search');

-- prosecdef: keyword INVOKER (false), semantic + hybrid DEFINER (true).
select is(
  (select prosecdef from pg_proc
    where oid = 'public.keyword_search(text, public.media_kind, integer)'::regprocedure),
  false,
  'keyword_search is SECURITY INVOKER');
select is(
  (select prosecdef from pg_proc
    where oid = 'public.semantic_search(extensions.vector, public.media_kind, integer)'::regprocedure),
  true,
  'semantic_search is SECURITY DEFINER');
select is(
  (select prosecdef from pg_proc
    where oid = 'public.hybrid_search(text, extensions.vector, public.media_kind, integer)'::regprocedure),
  true,
  'hybrid_search is SECURITY DEFINER');

-- proconfig: all three pin search_path to empty.
select ok(
  (select proconfig from pg_proc
    where oid = 'public.keyword_search(text, public.media_kind, integer)'::regprocedure)
    @> array['search_path=""'],
  'keyword_search pins search_path to empty');
select ok(
  (select proconfig from pg_proc
    where oid = 'public.semantic_search(extensions.vector, public.media_kind, integer)'::regprocedure)
    @> array['search_path=""'],
  'semantic_search pins search_path to empty');
select ok(
  (select proconfig from pg_proc
    where oid = 'public.hybrid_search(text, extensions.vector, public.media_kind, integer)'::regprocedure)
    @> array['search_path=""'],
  'hybrid_search pins search_path to empty');

-- Exactly the intended argument counts.
select is(
  (select pronargs from pg_proc
    where oid = 'public.keyword_search(text, public.media_kind, integer)'::regprocedure)::int,
  3,
  'keyword_search takes exactly three args');
select is(
  (select pronargs from pg_proc
    where oid = 'public.semantic_search(extensions.vector, public.media_kind, integer)'::regprocedure)::int,
  3,
  'semantic_search takes exactly three args');
select is(
  (select pronargs from pg_proc
    where oid = 'public.hybrid_search(text, extensions.vector, public.media_kind, integer)'::regprocedure)::int,
  4,
  'hybrid_search takes exactly four args');

-- ---------------------------------------------------------------------------
-- Seed two deterministic embeddings (as the default superuser pgTAP role):
--   A = quiet-signal -> unit vector on axis 1
--   B = afterglow    -> unit vector on axis 2
-- ---------------------------------------------------------------------------
insert into public.media_search_documents
  (media_id, content, content_hash, document_version, embedding,
   embedding_model, embedding_provider, embedding_dimensions, embedded_at)
select id, 'x', repeat('a', 64), 'v1',
       ('[1' || repeat(',0', 511) || ']')::extensions.vector,
       'fake', 'fake', 512, now()
  from public.media_items where slug = 'quiet-signal';
insert into public.media_search_documents
  (media_id, content, content_hash, document_version, embedding,
   embedding_model, embedding_provider, embedding_dimensions, embedded_at)
select id, 'x', repeat('a', 64), 'v1',
       ('[0,1' || repeat(',0', 510) || ']')::extensions.vector,
       'fake', 'fake', 512, now()
  from public.media_items where slug = 'afterglow';

-- ---------------------------------------------------------------------------
-- 6. Keyword ranking + exact-title.
-- ---------------------------------------------------------------------------
select is(
  (select slug from public.keyword_search('dune', null, 5) limit 1),
  'dune-part-two',
  'keyword_search ranks the Dune title first for "dune"');
select is(
  (select slug from public.keyword_search('Quiet Signal', null, 5) limit 1),
  'quiet-signal',
  'an exact-title query ranks that title first');

-- ---------------------------------------------------------------------------
-- 7. Media-kind filtering ("glass" matches a TV and a book title).
-- ---------------------------------------------------------------------------
select is(
  (select count(*)::int from public.keyword_search('glass', 'book', 5)
    where kind <> 'book'),
  0,
  'p_kind=book narrows keyword_search to book rows only');
select ok(
  exists (select 1 from public.keyword_search('glass', 'book', 5)
           where slug = 'seas-of-glass'),
  'the matching book title is present under the book filter');

-- ---------------------------------------------------------------------------
-- 8. Strict, clamped limits.
-- ---------------------------------------------------------------------------
select ok(
  (select count(*)::int from public.keyword_search('drama', null, 1000)) <= 50,
  'a huge p_limit is clamped to at most 50 rows');
select ok(
  (select count(*)::int from public.keyword_search('drama', null, 0)) between 1 and 50,
  'a non-positive p_limit is clamped up to at least 1 row');

-- ---------------------------------------------------------------------------
-- 9. Invalid / null args short-circuit to zero rows.
-- ---------------------------------------------------------------------------
select is(
  (select count(*)::int from public.keyword_search('', null, 5)),
  0,
  'an empty query returns no rows');
select is(
  (select count(*)::int
     from public.semantic_search(null::extensions.vector, null, 5)),
  0,
  'a null query embedding returns no rows');

-- ---------------------------------------------------------------------------
-- 10. Semantic ranking with deterministic vectors.
--     Query ~ axis-1 -> quiet-signal (A) is the nearest neighbour.
-- ---------------------------------------------------------------------------
select is(
  (select slug from public.semantic_search(
     ('[0.9,0.1' || repeat(',0', 510) || ']')::extensions.vector, null, 5)
    limit 1),
  'quiet-signal',
  'semantic_search returns the cosine-nearest title first');

-- ---------------------------------------------------------------------------
-- 11. Hybrid RRF + exact-title protection.
--     Query text = "afterglow"; query embedding closest to quiet-signal.
--     Exact-title protection keeps afterglow first; fusion still surfaces the
--     semantic hit (quiet-signal) alongside it.
-- ---------------------------------------------------------------------------
select is(
  (select slug from public.hybrid_search(
     'afterglow',
     ('[1' || repeat(',0', 511) || ']')::extensions.vector, null, 5)
    limit 1),
  'afterglow',
  'exact-title protection keeps the title first in hybrid_search');
select is(
  (select count(distinct slug)::int from public.hybrid_search(
     'afterglow',
     ('[1' || repeat(',0', 511) || ']')::extensions.vector, null, 5)
    where slug in ('afterglow', 'quiet-signal')),
  2,
  'hybrid_search fuses a keyword hit and a semantic hit');

-- ---------------------------------------------------------------------------
-- 5. No ordinary-user access to the private embedding table (raw vectors).
-- ---------------------------------------------------------------------------
set local role anon;
select throws_ok(
  $$ select * from public.media_search_documents $$,
  '42501', null,
  'anon cannot read the private embedding table');

set local role authenticated;
select throws_ok(
  $$ select * from public.media_search_documents $$,
  '42501', null,
  'authenticated cannot read the private embedding table');

-- ---------------------------------------------------------------------------
-- 12. Anonymous safe search access (through the functions only).
-- ---------------------------------------------------------------------------
set local role anon;
select lives_ok(
  $$ select * from public.keyword_search('dune', null, 5) $$,
  'anon can run keyword_search');
select lives_ok(
  $$ select * from public.semantic_search(
       ('[0.9,0.1' || repeat(',0', 510) || ']')::extensions.vector, null, 5) $$,
  'anon can run semantic_search even though the table is private');

reset role;

select * from finish();
rollback;
