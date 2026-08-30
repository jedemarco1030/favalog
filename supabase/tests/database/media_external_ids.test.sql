-- pgTAP coverage for Catalog Platform v1B: the canonical external identity
-- alias table (public.media_external_ids) + the canonical-resolving trusted
-- write path public.materialize_external_media (migration 20260815120600).
--
-- Proves the database-level guarantees the application relies on: the alias
-- table + constraints, the security/grant posture, the full canonical
-- resolution order (existing link -> existing provider row -> conservative
-- deterministic title+kind+year candidate -> new row), ambiguous fail-safe,
-- movie/TV id separation, idempotency, immutable slugs, preservation of the
-- curated catalog + community ratings, FK cascade, and — critically — that
-- importing TMDB movie 693134 cannot create a second 'Dune: Part Two' row when
-- the curated Favalog title already exists.
--
-- Run in a transaction as the migration/superuser (RLS is bypassed here); the
-- grant assertions independently prove browser roles cannot write or execute.

begin;
select plan(43);

-- The full function identity, reused by the privilege assertions.
\set fn 'public.materialize_external_media(text, public.media_kind, text, text, text, text, integer, text, text, numeric, text[], jsonb, text, text)'

-- ---------------------------------------------------------------------------
-- Schema: table, columns, constraints.
-- ---------------------------------------------------------------------------
select has_table('public', 'media_external_ids', 'media_external_ids table exists');
select has_column('public', 'media_external_ids', 'media_id', 'has media_id');
select has_column('public', 'media_external_ids', 'provider', 'has provider');
select has_column('public', 'media_external_ids', 'kind', 'has kind');
select has_column('public', 'media_external_ids', 'external_id', 'has external_id');
select col_is_fk('public', 'media_external_ids', 'media_id', 'media_id is a foreign key');
select has_index(
  'public', 'media_external_ids', 'media_external_ids_provider_identity_key',
  array['provider', 'kind', 'external_id'],
  'unique (provider, kind, external_id) exists'
);
select has_index(
  'public', 'media_external_ids', 'media_external_ids_media_provider_kind_key',
  array['media_id', 'provider', 'kind'],
  'unique (media_id, provider, kind) exists'
);

-- ---------------------------------------------------------------------------
-- Security: RLS enabled, public read policy, least-privilege grants.
-- ---------------------------------------------------------------------------
select is(
  (select relrowsecurity from pg_class where oid = 'public.media_external_ids'::regclass),
  true,
  'RLS is enabled on media_external_ids'
);
select policies_are(
  'public', 'media_external_ids', array['media_external_ids_public_read'],
  'exactly the public-read policy exists'
);
select ok(
  has_table_privilege('anon', 'public.media_external_ids', 'SELECT'),
  'anon may SELECT media_external_ids (public read)'
);
select ok(
  NOT has_table_privilege('anon', 'public.media_external_ids', 'INSERT'),
  'anon may NOT INSERT media_external_ids'
);
select ok(
  NOT has_table_privilege('authenticated', 'public.media_external_ids', 'UPDATE'),
  'authenticated may NOT UPDATE media_external_ids'
);

-- The RPC exists and EXECUTE is granted ONLY to service_role.
select has_function('public', 'materialize_external_media', 'materialize_external_media exists');
select ok(has_function_privilege('service_role', :'fn', 'EXECUTE'), 'service_role may EXECUTE');
select ok(NOT has_function_privilege('anon', :'fn', 'EXECUTE'), 'anon may NOT EXECUTE');
select ok(NOT has_function_privilege('authenticated', :'fn', 'EXECUTE'), 'authenticated may NOT EXECUTE');

-- Record the pre-existing curated catalog size + the curated Dune identity for
-- later preservation / no-duplicate checks.
create temporary table _curated_before as
  select count(*) as n from public.media_items where source = 'favalog';
create temporary table _dune_before as
  select id, slug, average_rating
  from public.media_items
  where source = 'favalog' and slug = 'dune-part-two';

-- ---------------------------------------------------------------------------
-- (C) Conservative deterministic candidate: importing TMDB movie 693134
-- ('Dune: Part Two', 2024, movie) links to the EXISTING curated title.
-- This is the central duplicate-prevention guarantee.
-- ---------------------------------------------------------------------------
select is(
  (public.materialize_external_media(
     'tmdb', 'movie'::public.media_kind, 'movie:693134', 'Dune: Part Two',
     null, 'Paul Atreides unites with the Fremen.', 2024,
     null, null, 4.5,
     array['Science Fiction','Epic']::text[],
     '{"runtimeMinutes":166,"director":"Denis Villeneuve","cast":["Timothee Chalamet"]}'::jsonb,
     repeat('d', 64), 'v1'
   ) ->> 'resolution'),
  'linked',
  'importing TMDB Dune: Part Two links to the existing curated title'
);
select is(
  (public.materialize_external_media(
     'tmdb', 'movie'::public.media_kind, 'movie:693134', 'Dune: Part Two',
     null, 'Paul Atreides unites with the Fremen.', 2024,
     null, null, 4.5, array['Science Fiction','Epic']::text[],
     '{}'::jsonb, repeat('d', 64), 'v1'
   ) ->> 'slug'),
  'dune-part-two',
  'returns the existing immutable canonical slug'
);
select is(
  (select count(*)::int from public.media_items
     where kind = 'movie' and title = 'Dune: Part Two'),
  1,
  'no duplicate Dune: Part Two row is created'
);
select is(
  (select count(*)::int from public.media_items where slug = 'dune-part-two'),
  1,
  'the curated dune-part-two slug still resolves to exactly one row'
);
-- Community rating (user-derived) is preserved; only empty provider fields fill.
select is(
  (select average_rating from public.media_items where slug = 'dune-part-two'),
  (select average_rating from _dune_before),
  'community average_rating is preserved (never overwritten)'
);
-- The alias link now points at the SAME curated media id (no new row).
select is(
  (select media_id from public.media_external_ids
     where provider = 'tmdb' and kind = 'movie' and external_id = 'movie:693134'),
  (select id from _dune_before),
  'the alias links TMDB movie 693134 to the existing curated media id'
);

-- (A) Exact existing provider LINK: a repeat import resolves via the alias and
-- reports 'existing' (idempotent), never creating a duplicate.
select is(
  (public.materialize_external_media(
     'tmdb', 'movie'::public.media_kind, 'movie:693134', 'Dune: Part Two',
     null, 'x', 2024, null, null, 4.5, array[]::text[], '{}'::jsonb,
     repeat('d', 64), 'v1'
   ) ->> 'resolution'),
  'existing',
  'a repeat import resolves via the existing provider link'
);
select is(
  (select count(*)::int from public.media_items where kind = 'movie' and title = 'Dune: Part Two'),
  1,
  'repeat import still leaves exactly one Dune: Part Two'
);

-- ---------------------------------------------------------------------------
-- (D) New item insertion: an unmatched external title creates a new row and a
-- 'created' outcome, immediately keyword-searchable.
-- ---------------------------------------------------------------------------
select is(
  (public.materialize_external_media(
     'tmdb', 'movie'::public.media_kind, 'movie:603', 'The Matrix',
     null, 'A hacker discovers reality is a simulation.', 1999,
     null, null, 4.1, array['Action','Science Fiction']::text[],
     '{"runtimeMinutes":136,"director":"Lana Wachowski","cast":["Keanu Reeves"]}'::jsonb,
     repeat('a', 64), 'v1'
   ) ->> 'resolution'),
  'created',
  'an unmatched external title creates a new canonical row'
);
select is(
  (select slug from public.media_items where source = 'tmdb' and external_id = 'movie:603'),
  'the-matrix',
  'the new row gets a slug generated from the title'
);
select isnt(
  (select search_tsv from public.media_items where source = 'tmdb' and external_id = 'movie:603'),
  null,
  'the new row is immediately keyword-searchable (search_tsv populated)'
);
select ok(
  (select synced_at is not null and normalization_version = 'v1'
     from public.media_items where source = 'tmdb' and external_id = 'movie:603'),
  'the new row is marked with provenance for eventual embedding'
);

-- (D) Repeated + idempotent: re-importing the created identity does not
-- duplicate and keeps the immutable slug.
select is(
  (public.materialize_external_media(
     'tmdb', 'movie'::public.media_kind, 'movie:603', 'The Matrix Reloaded Title Change',
     null, 'Updated synopsis.', 1999, null, null, 4.2, array['Action']::text[],
     '{}'::jsonb, repeat('b', 64), 'v1'
   ) ->> 'inserted')::boolean,
  false,
  'repeat materialization of a created row reports inserted=false'
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

-- ---------------------------------------------------------------------------
-- Movie/TV id separation: the SAME numeric TMDB id in different kinds are
-- distinct identities and distinct rows.
-- ---------------------------------------------------------------------------
select lives_ok(
  $$ select public.materialize_external_media(
       'tmdb', 'tv'::public.media_kind, 'tv:603', 'A Series Sharing An Id',
       null, '', 2020, null, null, null, array[]::text[], '{}'::jsonb,
       repeat('e', 64), 'v1'
     ) $$,
  'a TV id sharing the numeric space of a movie id materializes independently'
);
select is(
  (select count(distinct id)::int from public.media_items
     where source = 'tmdb' and external_id in ('movie:603', 'tv:603')),
  2,
  'movie:603 and tv:603 are two distinct canonical rows'
);

-- ---------------------------------------------------------------------------
-- (B) Exact existing provider ROW without a pre-existing alias: v1A's
-- materialize_media_item wrote a row; materialize_external_media backfills the
-- alias and reuses the row.
-- ---------------------------------------------------------------------------
select public.materialize_media_item(
  'openlibrary', 'book'::public.media_kind, 'OL999W', 'A Legacy V1A Book',
  null, 'Written by the v1A path.', 2015, null, null, null,
  array['Nonfiction']::text[],
  '{"authors":["Someone"],"pageCount":200}'::jsonb, repeat('f', 64), 'v1'
);
select is(
  (public.materialize_external_media(
     'openlibrary', 'book'::public.media_kind, 'OL999W', 'A Legacy V1A Book',
     null, 'Written by the v1A path.', 2015, null, null, null,
     array['Nonfiction']::text[],
     '{"authors":["Someone"],"pageCount":200}'::jsonb, repeat('f', 64), 'v1'
   ) ->> 'resolution'),
  'existing',
  'an existing provider row (no alias yet) resolves to existing + backfills alias'
);
select is(
  (select count(*)::int from public.media_external_ids
     where provider = 'openlibrary' and external_id = 'OL999W'),
  1,
  'the alias is backfilled for the pre-existing provider row'
);

-- ---------------------------------------------------------------------------
-- Ambiguous fail-safe: two candidate rows sharing normalized title + kind +
-- year cause a P0003 rejection rather than mis-attaching.
-- ---------------------------------------------------------------------------
insert into public.media_items (kind, source, external_id, slug, title, year)
values
  ('movie', 'favalog', 'amb_1', 'ambiguous-one', 'Ambiguous Title', 2010),
  ('movie', 'favalog', 'amb_2', 'ambiguous-two', 'Ambiguous Title', 2010);
select throws_ok(
  $$ select public.materialize_external_media(
       'tmdb', 'movie'::public.media_kind, 'movie:70001', 'Ambiguous Title',
       null, '', 2010, null, null, null, array[]::text[], '{}'::jsonb,
       repeat('a', 64), 'v1'
     ) $$,
  'P0003',
  null,
  'an ambiguous deterministic match fails safely (P0003)'
);
select is(
  (select count(*)::int from public.media_external_ids
     where provider = 'tmdb' and external_id = 'movie:70001'),
  0,
  'no alias is attached on an ambiguous match'
);

-- A candidate already carrying a DIFFERENT identity for the same provider+kind
-- is rejected as ambiguous rather than double-linked.
select throws_ok(
  $$ select public.materialize_external_media(
       'tmdb', 'movie'::public.media_kind, 'movie:693135', 'Dune: Part Two',
       null, '', 2024, null, null, null, array[]::text[], '{}'::jsonb,
       repeat('a', 64), 'v1'
     ) $$,
  'P0003',
  null,
  'a second TMDB movie id for an already-linked title fails safely'
);

-- ---------------------------------------------------------------------------
-- Validation errors mirror the v1A write path (mapped to 22023).
-- ---------------------------------------------------------------------------
select throws_ok(
  $$ select public.materialize_external_media(
       'tmdb', 'movie'::public.media_kind, 'movie:1', 'Bad Year', null, '', 999,
       null, null, null, array[]::text[], '{}'::jsonb, repeat('a', 64), 'v1'
     ) $$,
  '22023', null, 'rejects an implausible year'
);
select throws_ok(
  $$ select public.materialize_external_media(
       'nope', 'movie'::public.media_kind, 'movie:1', 'Bad Provider', null, '',
       2000, null, null, null, array[]::text[], '{}'::jsonb, repeat('a', 64), 'v1'
     ) $$,
  '22023', null, 'rejects an unknown provider'
);

-- ---------------------------------------------------------------------------
-- FK cascade: deleting a canonical row removes its aliases (no orphans).
-- ---------------------------------------------------------------------------
delete from public.media_items where source = 'tmdb' and external_id = 'movie:603';
select is(
  (select count(*)::int from public.media_external_ids
     where provider = 'tmdb' and external_id = 'movie:603'),
  0,
  'deleting a canonical row cascades to its external-id aliases'
);

-- ---------------------------------------------------------------------------
-- The curated source='favalog' catalog is otherwise preserved (Dune links did
-- not delete/duplicate curated rows; the ambiguous fixtures added exactly two).
-- ---------------------------------------------------------------------------
select is(
  (select count(*)::int from public.media_items where source = 'favalog'),
  (select n::int from _curated_before) + 2,
  'curated favalog catalog is preserved (only the two ambiguity fixtures added)'
);

select finish();
rollback;
