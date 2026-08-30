-- pgTAP coverage for Catalog Platform v1A: provenance columns + the trusted
-- materialize_media_item RPC (migration 20260815120500).
--
-- Verifies the database-level guarantees the application relies on: the new
-- provenance columns + CHECK, the security/grant posture, immutable
-- collision-safe slugs, idempotency, keyword-search availability of a new row,
-- validation errors, and preservation of the curated source='favalog' catalog.
--
-- Run in a transaction as the migration/superuser (RLS is bypassed here); the
-- grant assertions independently prove browser roles cannot execute the RPC.

begin;
select plan(20);

-- The full function identity, reused by the privilege assertions.
\set fn 'public.materialize_media_item(text, public.media_kind, text, text, text, text, integer, text, text, numeric, text[], jsonb, text, text)'

-- 1–3. Provenance columns exist.
select has_column('public', 'media_items', 'content_hash', 'media_items has content_hash');
select has_column('public', 'media_items', 'normalization_version', 'media_items has normalization_version');
select has_column('public', 'media_items', 'synced_at', 'media_items has synced_at');

-- 4. The RPC exists.
select has_function(
  'public', 'materialize_media_item',
  'materialize_media_item function exists'
);

-- 5–7. EXECUTE is granted ONLY to service_role.
select ok(
  has_function_privilege('service_role', :'fn', 'EXECUTE'),
  'service_role may EXECUTE materialize_media_item'
);
select ok(
  NOT has_function_privilege('anon', :'fn', 'EXECUTE'),
  'anon may NOT EXECUTE materialize_media_item'
);
select ok(
  NOT has_function_privilege('authenticated', :'fn', 'EXECUTE'),
  'authenticated may NOT EXECUTE materialize_media_item'
);

-- Record the pre-existing curated catalog size for a later preservation check.
create temporary table _curated_before as
  select count(*) as n from public.media_items where source = 'favalog';

-- 8. A trusted materialization inserts a provider row.
select lives_ok(
  $$ select public.materialize_media_item(
       'tmdb', 'movie'::public.media_kind, 'movie:603', 'The Matrix',
       null, 'A hacker discovers reality is a simulation.', 1999,
       null, null, 4.1,
       array['Action','Science Fiction']::text[],
       '{"runtimeMinutes":136,"director":"Lana Wachowski","cast":["Keanu Reeves"]}'::jsonb,
       repeat('a', 64), 'v1'
     ) $$,
  'materialize inserts a tmdb movie'
);

-- 9. Identity is stored with the kind-qualified external id.
select is(
  (select external_id from public.media_items where source = 'tmdb' and slug = 'the-matrix'),
  'movie:603',
  'stores the kind-qualified external id'
);

-- 10. A readable, immutable slug is generated from the title.
select is(
  (select slug from public.media_items where source = 'tmdb' and external_id = 'movie:603'),
  'the-matrix',
  'generates a slug from the title'
);

-- 11. Provenance is persisted.
select is(
  (select normalization_version from public.media_items where source = 'tmdb' and external_id = 'movie:603'),
  'v1',
  'persists the normalization version'
);

-- 12. The row is IMMEDIATELY keyword-searchable (search_tsv is generated).
select isnt(
  (select search_tsv from public.media_items where source = 'tmdb' and external_id = 'movie:603'),
  null,
  'new row is immediately keyword-searchable (search_tsv populated)'
);

-- 13–15. Idempotency: re-materializing the SAME identity does not duplicate,
-- keeps the same slug, and reports inserted=false.
select is(
  (select (public.materialize_media_item(
     'tmdb', 'movie'::public.media_kind, 'movie:603', 'The Matrix',
     null, 'Updated synopsis.', 1999, null, null, 4.2,
     array['Action']::text[],
     '{"runtimeMinutes":136,"director":"Lana Wachowski","cast":["Keanu Reeves"]}'::jsonb,
     repeat('b', 64), 'v1'
   ) ->> 'inserted')::boolean),
  false,
  'repeat materialization reports inserted=false'
);
select is(
  (select count(*)::int from public.media_items where source = 'tmdb' and external_id = 'movie:603'),
  1,
  'repeat materialization does not create a duplicate row'
);
select is(
  (select slug from public.media_items where source = 'tmdb' and external_id = 'movie:603'),
  'the-matrix',
  'repeat materialization keeps the immutable slug'
);

-- 16. Slug collision with a DIFFERENT identity gets a deterministic suffix and
-- never rewrites the original title's slug.
select lives_ok(
  $$ select public.materialize_media_item(
       'tmdb', 'movie'::public.media_kind, 'movie:604', 'The Matrix',
       null, 'A different film that happens to share a title.', 2021,
       null, null, null, array[]::text[], '{}'::jsonb, repeat('c', 64), 'v1'
     ) $$,
  'materialize a colliding title'
);
select is(
  (select slug from public.media_items where source = 'tmdb' and external_id = 'movie:604'),
  'the-matrix-2',
  'slug collision resolves with a deterministic suffix'
);

-- 17–18. Validation errors are raised (mapped to 22023).
select throws_ok(
  $$ select public.materialize_media_item(
       'tmdb', 'movie'::public.media_kind, 'movie:999', 'Bad Year', null, '', 999,
       null, null, null, array[]::text[], '{}'::jsonb, repeat('a', 64), 'v1'
     ) $$,
  '22023',
  null,
  'rejects an implausible year'
);
select throws_ok(
  $$ select public.materialize_media_item(
       'tmdb', 'movie'::public.media_kind, 'movie:998', 'Bad Hash', null, '', 2000,
       null, null, null, array[]::text[], '{}'::jsonb, 'not-a-hash', 'v1'
     ) $$,
  '22023',
  null,
  'rejects a malformed content hash'
);

-- 19. The curated source='favalog' catalog is untouched.
select is(
  (select count(*)::int from public.media_items where source = 'favalog'),
  (select n::int from _curated_before),
  'curated favalog catalog is preserved'
);

select finish();
rollback;
