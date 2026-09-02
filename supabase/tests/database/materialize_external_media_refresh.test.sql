-- pgTAP regression coverage for the v1B follow-up (migration 20260815120700):
-- re-importing an ALREADY-LINKED provider identity now performs a genuine
-- provider metadata refresh (year / genres / details) atomically with its
-- provenance, while preserving media id / slug / alias and every user-owned row.
--
-- This proves the exact defect from migration 20260815120600 is fixed: the old
-- alias branch advanced content_hash / normalization_version but left genres,
-- year, and details STALE, so the Phase 4A.1 canonical genre cleanup never
-- reached an already-imported Open Library row.
--
-- Self-contained: creates its own auth user (…3333 Carol) inside a transaction
-- that is rolled back, and reuses the curated catalog + the trusted
-- materialize_external_media write path. Does NOT depend on seed.sql. RLS is
-- bypassed here (migration/superuser); user-owned rows are inserted directly to
-- assert they survive the refresh untouched.
--
-- Run with the local stack: `npm run db:test` (requires Docker + Supabase CLI).

begin;
select plan(32);

\set fn 'public.materialize_external_media(text, public.media_kind, text, text, text, text, integer, text, text, numeric, text[], jsonb, text, text)'

-- ---------------------------------------------------------------------------
-- Security posture is unchanged after the forward-only recreate.
-- ---------------------------------------------------------------------------
select is(
  (select prosecdef from pg_proc where oid = :'fn'::regprocedure),
  false,
  'materialize_external_media remains SECURITY INVOKER (not DEFINER)');
select ok(
  (select proconfig from pg_proc where oid = :'fn'::regprocedure)
    @> array['search_path=""'],
  'materialize_external_media pins search_path to empty');
select ok(
  has_function_privilege('service_role', :'fn', 'EXECUTE'),
  'service_role may EXECUTE materialize_external_media');
select ok(
  NOT has_function_privilege('anon', :'fn', 'EXECUTE'),
  'anon may NOT EXECUTE materialize_external_media');
select ok(
  NOT has_function_privilege('authenticated', :'fn', 'EXECUTE'),
  'authenticated may NOT EXECUTE materialize_external_media');

-- ---------------------------------------------------------------------------
-- Fixture user (profile created by the handle_new_user trigger).
-- ---------------------------------------------------------------------------
insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data)
values
  ('00000000-0000-0000-0000-000000000000',
   '33333333-3333-3333-3333-333333333333',
   'authenticated', 'authenticated', 'carol_ext@example.com',
   '{"username":"carol_ext","display_name":"Carol"}');

-- ---------------------------------------------------------------------------
-- (1) Create an Open Library book carrying HISTORICAL / RAW genres, exactly as
-- an old pre-fix import would have persisted them. This creates the row AND its
-- media_external_ids alias in one call.
-- ---------------------------------------------------------------------------
select is(
  (public.materialize_external_media(
     'openlibrary', 'book'::public.media_kind, 'OL893414W', 'Dune',
     null, 'Old synopsis.', 1965, null, null, null,
     array['Dune (Imaginary place)','award:nebula_award=novel','Fiction, science fiction, general']::text[],
     '{"authors":["Frank Herbert"],"pageCount":412}'::jsonb,
     repeat('1', 64), 'v1'
   ) ->> 'resolution'),
  'created',
  'an unmatched Open Library work creates a new canonical row');

-- Capture the created identity + alias so we can prove they never change.
create temporary table _ol_before as
  select id, slug
  from public.media_items
  where source = 'openlibrary' and external_id = 'OL893414W';
create temporary table _alias_before as
  select id as alias_id, media_id
  from public.media_external_ids
  where provider = 'openlibrary' and kind = 'book' and external_id = 'OL893414W';

select is(
  (select genres from public.media_items where id = (select id from _ol_before)),
  array['Dune (Imaginary place)','award:nebula_award=novel','Fiction, science fiction, general']::text[],
  'the pre-fix row initially carries the raw historical genres');

-- ---------------------------------------------------------------------------
-- Attach user-owned rows to the created book (inserted directly; RLS bypassed).
-- These must be BYTE-FOR-BYTE preserved across a refresh.
-- ---------------------------------------------------------------------------
insert into public.diary_entries (id, user_id, media_id, logged_at, rating)
values (
  '44444444-4444-4444-4444-444444444444',
  '33333333-3333-3333-3333-333333333333',
  (select id from _ol_before),
  '2024-01-02T00:00:00Z', 4.5);
insert into public.reviews (id, user_id, media_id, diary_entry_id, body)
values (
  '55555555-5555-5555-5555-555555555555',
  '33333333-3333-3333-3333-333333333333',
  (select id from _ol_before),
  '44444444-4444-4444-4444-444444444444',
  'A towering achievement.');
insert into public.favorites (id, user_id, media_id, position)
values (
  '66666666-6666-6666-6666-666666666666',
  '33333333-3333-3333-3333-333333333333',
  (select id from _ol_before), 0);
insert into public.lists (id, user_id, slug, title, visibility)
values (
  '77777777-7777-7777-7777-777777777777',
  '33333333-3333-3333-3333-333333333333',
  'carol-favorites', 'Carol Favorites', 'public');
insert into public.list_items (id, list_id, media_id, position)
values (
  '88888888-8888-8888-8888-888888888888',
  '77777777-7777-7777-7777-777777777777',
  (select id from _ol_before), 0);

-- ---------------------------------------------------------------------------
-- (2) RE-IMPORT the SAME identity with CANONICAL genres, an updated year, new
-- details, and fresh provenance. This resolves via the existing alias and MUST
-- perform a genuine full refresh (the fixed behavior).
-- ---------------------------------------------------------------------------
select is(
  (public.materialize_external_media(
     'openlibrary', 'book'::public.media_kind, 'OL893414W', 'Dune',
     null, 'A new canonical synopsis.', 1966, null, null, 4.0,
     array['Science Fiction']::text[],
     '{"authors":["Frank Herbert"],"pageCount":896}'::jsonb,
     repeat('2', 64), 'v1'
   ) ->> 'resolution'),
  'existing',
  'a re-import of the already-linked identity resolves via the alias');

-- --- The core fix: genres are actually replaced with the canonical values. ---
select is(
  (select genres from public.media_items where id = (select id from _ol_before)),
  array['Science Fiction']::text[],
  'the refresh REPLACES the stored genres with the canonical values');

-- --- year / details / provenance / timestamps reflect the refreshed payload. -
select is(
  (select year from public.media_items where id = (select id from _ol_before)),
  1966,
  'the refresh updates the year');
select is(
  (select synopsis from public.media_items where id = (select id from _ol_before)),
  'A new canonical synopsis.',
  'the refresh updates the synopsis');
select is(
  (select average_rating from public.media_items where id = (select id from _ol_before)),
  4.0::numeric,
  'the refresh updates the provider rating');
select is(
  (select details ->> 'pageCount' from public.media_items where id = (select id from _ol_before)),
  '896',
  'the refresh updates kind-specific details');
select is(
  (select content_hash from public.media_items where id = (select id from _ol_before)),
  repeat('2', 64),
  'the refresh updates content_hash to the new payload');
select ok(
  (select synced_at from public.media_items where id = (select id from _ol_before)) is not null,
  'the refresh stamps synced_at');

-- --- PROVENANCE CONSISTENCY: content_hash advanced AND genres advanced. This
-- --- is the exact mismatch the bug produced (hash new, genres stale). ---------
select ok(
  (select content_hash = repeat('2', 64)
      and genres = array['Science Fiction']::text[]
     from public.media_items where id = (select id from _ol_before)),
  'provenance and provider metadata advance together (no hash/genres mismatch)');

-- ---------------------------------------------------------------------------
-- Identity + alias are unchanged; no duplicate media or alias created.
-- ---------------------------------------------------------------------------
select is(
  (select id from public.media_items where source = 'openlibrary' and external_id = 'OL893414W'),
  (select id from _ol_before),
  'the media id is unchanged by the refresh');
select is(
  (select slug from public.media_items where source = 'openlibrary' and external_id = 'OL893414W'),
  (select slug from _ol_before),
  'the immutable slug is unchanged by the refresh');
select is(
  (select count(*)::int from public.media_items where source = 'openlibrary' and external_id = 'OL893414W'),
  1,
  'no duplicate media row is created by the refresh');
select is(
  (select count(*)::int from public.media_external_ids
     where provider = 'openlibrary' and kind = 'book' and external_id = 'OL893414W'),
  1,
  'no duplicate alias is created by the refresh');
select is(
  (select id from public.media_external_ids
     where provider = 'openlibrary' and kind = 'book' and external_id = 'OL893414W'),
  (select alias_id from _alias_before),
  'the alias row id is unchanged by the refresh');

-- ---------------------------------------------------------------------------
-- Every user-owned row survives the refresh untouched.
-- ---------------------------------------------------------------------------
select is(
  (select count(*)::int from public.diary_entries
     where id = '44444444-4444-4444-4444-444444444444'
       and media_id = (select id from _ol_before) and rating = 4.5),
  1,
  'the diary entry is preserved (id, media, rating)');
select is(
  (select count(*)::int from public.reviews
     where id = '55555555-5555-5555-5555-555555555555'
       and media_id = (select id from _ol_before)
       and diary_entry_id = '44444444-4444-4444-4444-444444444444'),
  1,
  'the review is preserved (id, media, diary link)');
select is(
  (select count(*)::int from public.favorites
     where id = '66666666-6666-6666-6666-666666666666'
       and media_id = (select id from _ol_before) and position = 0),
  1,
  'the favorite is preserved (id, media, position)');
select is(
  (select count(*)::int from public.list_items
     where id = '88888888-8888-8888-8888-888888888888'
       and media_id = (select id from _ol_before) and position = 0),
  1,
  'the list membership is preserved (id, media, position)');

-- ---------------------------------------------------------------------------
-- A curated favalog row reached via a canonical alias is NOT overwritten: link
-- TMDB movie 693134 to the curated 'Dune: Part Two', then re-import it with
-- DIFFERENT genres/year and prove the curated metadata is retained.
-- ---------------------------------------------------------------------------
create temporary table _dune_curated_before as
  select id, slug, title, year, genres, average_rating
  from public.media_items
  where source = 'favalog' and slug = 'dune-part-two';

select is(
  (public.materialize_external_media(
     'tmdb', 'movie'::public.media_kind, 'movie:693134', 'Dune: Part Two',
     null, 'Provider synopsis.', 2024, null, null, 3.0,
     array['Action']::text[], '{}'::jsonb, repeat('a', 64), 'v1'
   ) ->> 'resolution'),
  'linked',
  'importing TMDB Dune: Part Two links to the curated title');
-- Re-import the now-linked identity with DIFFERENT provider metadata.
select is(
  (public.materialize_external_media(
     'tmdb', 'movie'::public.media_kind, 'movie:693134', 'Dune: Part Two',
     null, 'Different synopsis.', 1999, null, null, 1.0,
     array['Comedy']::text[], '{"runtimeMinutes":1}'::jsonb, repeat('b', 64), 'v1'
   ) ->> 'resolution'),
  'existing',
  'a re-import of the curated-linked identity resolves via the alias');
select is(
  (select genres from public.media_items where slug = 'dune-part-two'),
  (select genres from _dune_curated_before),
  'the curated row genres are NOT overwritten by a provider refresh');
select is(
  (select year from public.media_items where slug = 'dune-part-two'),
  (select year from _dune_curated_before),
  'the curated row year is NOT overwritten by a provider refresh');
select is(
  (select average_rating from public.media_items where slug = 'dune-part-two'),
  (select average_rating from _dune_curated_before),
  'the curated row community rating is NOT overwritten');
select is(
  (select title from public.media_items where slug = 'dune-part-two'),
  (select title from _dune_curated_before),
  'the curated row title is NOT overwritten');
select is(
  (select count(*)::int from public.media_items where slug = 'dune-part-two'),
  1,
  'no duplicate curated row is created by linking + refreshing');

select finish();
rollback;
