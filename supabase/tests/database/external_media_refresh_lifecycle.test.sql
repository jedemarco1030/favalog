-- pgTAP coverage for the provider-metadata REFRESH lifecycle
-- (migration 20260815121000): refresh_external_media,
-- mark_external_media_refresh_failed, mark_external_media_removed, and the
-- removal-aware retrieval functions.
--
-- Proves the foundation's invariants: authorization (service_role-only, pinned
-- search_path, SECURITY INVOKER), identity + user-data preservation, curated-row
-- protection, freshness-vs-content separation, stale-write rejection, transient
-- failure vs confirmed removal, and that a soft-removed row disappears from
-- discovery while its user references survive and a later refresh resurrects it.
--
-- IMPORTANT (frozen transaction time): pgTAP runs inside a single transaction, so
-- now() is CONSTANT throughout. Assertions therefore never rely on now() moving.
-- To prove the "unchanged" path does NOT rewrite content, the test first pins
-- synced_at to a DISTINCT past timestamp and asserts it is left intact, while
-- provider_checked_at (null after materialize) becomes non-null.
--
-- Self-contained: creates its own auth user + catalog rows via the trusted
-- write paths; does NOT depend on seed.sql. Run with the local stack:
-- `npm run db:test` (requires Docker + Supabase CLI).

begin;
select * from no_plan();

\set refresh_fn 'public.refresh_external_media(text, public.media_kind, text, text, text, text, integer, text, text, numeric, text[], jsonb, text, text, text)'
\set failed_fn 'public.mark_external_media_refresh_failed(text, public.media_kind, text, text)'
\set removed_fn 'public.mark_external_media_removed(text, public.media_kind, text)'

-- ---------------------------------------------------------------------------
-- Authorization / security posture for the three operator RPCs.
-- ---------------------------------------------------------------------------
select is(
  (select prosecdef from pg_proc where oid = :'refresh_fn'::regprocedure),
  false, 'refresh_external_media is SECURITY INVOKER (not DEFINER)');
select ok(
  (select proconfig from pg_proc where oid = :'refresh_fn'::regprocedure)
    @> array['search_path=""'],
  'refresh_external_media pins search_path to empty');
select ok(
  has_function_privilege('service_role', :'refresh_fn', 'EXECUTE'),
  'service_role may EXECUTE refresh_external_media');
select ok(
  NOT has_function_privilege('anon', :'refresh_fn', 'EXECUTE'),
  'anon may NOT EXECUTE refresh_external_media');
select ok(
  NOT has_function_privilege('authenticated', :'refresh_fn', 'EXECUTE'),
  'authenticated may NOT EXECUTE refresh_external_media');

select is(
  (select prosecdef from pg_proc where oid = :'failed_fn'::regprocedure),
  false, 'mark_external_media_refresh_failed is SECURITY INVOKER');
select ok(
  (select proconfig from pg_proc where oid = :'failed_fn'::regprocedure)
    @> array['search_path=""'],
  'mark_external_media_refresh_failed pins search_path to empty');
select ok(
  has_function_privilege('service_role', :'failed_fn', 'EXECUTE'),
  'service_role may EXECUTE mark_external_media_refresh_failed');
select ok(
  NOT has_function_privilege('anon', :'failed_fn', 'EXECUTE'),
  'anon may NOT EXECUTE mark_external_media_refresh_failed');
select ok(
  NOT has_function_privilege('authenticated', :'failed_fn', 'EXECUTE'),
  'authenticated may NOT EXECUTE mark_external_media_refresh_failed');

select is(
  (select prosecdef from pg_proc where oid = :'removed_fn'::regprocedure),
  false, 'mark_external_media_removed is SECURITY INVOKER');
select ok(
  (select proconfig from pg_proc where oid = :'removed_fn'::regprocedure)
    @> array['search_path=""'],
  'mark_external_media_removed pins search_path to empty');
select ok(
  has_function_privilege('service_role', :'removed_fn', 'EXECUTE'),
  'service_role may EXECUTE mark_external_media_removed');
select ok(
  NOT has_function_privilege('anon', :'removed_fn', 'EXECUTE'),
  'anon may NOT EXECUTE mark_external_media_removed');
select ok(
  NOT has_function_privilege('authenticated', :'removed_fn', 'EXECUTE'),
  'authenticated may NOT EXECUTE mark_external_media_removed');

-- ---------------------------------------------------------------------------
-- Fixtures. A user (for user-owned rows) + a TMDB provider-owned movie created
-- through the trusted materialization path (resolution 'created' — the title is
-- deliberately unlike any curated seed row).
-- ---------------------------------------------------------------------------
insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data)
values
  ('00000000-0000-0000-0000-000000000000',
   'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   'authenticated', 'authenticated', 'refresh_probe@example.com',
   '{"username":"refresh_probe","display_name":"Refresh Probe"}');

select is(
  (public.materialize_external_media(
     'tmdb', 'movie'::public.media_kind, 'movie:999001', 'Zephyrian Provider Probe',
     null, 'Original synopsis.', 2019, null, null, 3.0,
     array['Drama']::text[], '{"runtimeMinutes":100}'::jsonb,
     repeat('1', 64), 'v1'
   ) ->> 'resolution'),
  'created',
  'fixture: an unmatched TMDB movie creates a new provider-owned row');

create temporary table _probe as
  select id, slug
  from public.media_items
  where source = 'tmdb' and external_id = 'movie:999001';
create temporary table _probe_alias as
  select id as alias_id
  from public.media_external_ids
  where provider = 'tmdb' and kind = 'movie' and external_id = 'movie:999001';

-- provider_checked_at starts null (materialization does not perform a check).
select ok(
  (select provider_checked_at is null from public.media_items where id = (select id from _probe)),
  'a freshly materialized provider row has a null provider_checked_at');

-- Attach user-owned rows that MUST survive every refresh/removal outcome.
insert into public.diary_entries (id, user_id, media_id, logged_at, rating)
values ('dddddddd-dddd-dddd-dddd-dddddddddddd',
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        (select id from _probe), '2024-03-01T00:00:00Z', 4.0);
insert into public.reviews (id, user_id, media_id, diary_entry_id, body)
values ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        (select id from _probe),
        'dddddddd-dddd-dddd-dddd-dddddddddddd', 'A striking debut.');
insert into public.favorites (id, user_id, media_id, position)
values ('ffffffff-ffff-ffff-ffff-ffffffffffff',
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        (select id from _probe), 0);
insert into public.lists (id, user_id, slug, title, visibility)
values ('11111111-2222-3333-4444-555555555555',
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        'probe-list', 'Probe List', 'public');
insert into public.list_items (id, list_id, media_id, position)
values ('66666666-7777-8888-9999-000000000000',
        '11111111-2222-3333-4444-555555555555',
        (select id from _probe), 0);

-- Pin a DISTINCT past baseline so the "unchanged" path's non-mutation of
-- content is provable under frozen transaction time.
update public.media_items
   set synced_at = '2000-01-01T00:00:00Z', provider_checked_at = null
 where id = (select id from _probe);

-- ---------------------------------------------------------------------------
-- Unknown identity -> P0002 (refresh never imports).
-- ---------------------------------------------------------------------------
select throws_ok(
  $$ select public.refresh_external_media(
       'tmdb', 'movie'::public.media_kind, 'movie:does-not-exist', 'Nope',
       null, '', 2000, null, null, null, array[]::text[], '{}'::jsonb,
       repeat('7', 64), 'v1', null) $$,
  'P0002',
  'no such provider record',
  'refreshing an unknown provider identity raises P0002');

-- ---------------------------------------------------------------------------
-- UNCHANGED refresh: same content hash -> outcome 'unchanged', content + the
-- pinned synced_at baseline are intact, provider_checked_at becomes non-null.
-- ---------------------------------------------------------------------------
select is(
  (public.refresh_external_media(
     'tmdb', 'movie'::public.media_kind, 'movie:999001', 'Zephyrian Provider Probe',
     null, 'Original synopsis.', 2019, null, null, 3.0,
     array['Drama']::text[], '{"runtimeMinutes":100}'::jsonb,
     repeat('1', 64), 'v1', null
   ) ->> 'outcome'),
  'unchanged',
  'a same-hash refresh reports outcome=unchanged');
select is(
  (select content_hash from public.media_items where id = (select id from _probe)),
  repeat('1', 64),
  'unchanged refresh leaves content_hash intact');
select is(
  (select synced_at from public.media_items where id = (select id from _probe)),
  '2000-01-01T00:00:00Z'::timestamptz,
  'unchanged refresh does NOT advance synced_at (freshness != content change)');
select ok(
  (select provider_checked_at is not null from public.media_items where id = (select id from _probe)),
  'unchanged refresh records a successful freshness check (provider_checked_at set)');
select is(
  (select genres from public.media_items where id = (select id from _probe)),
  array['Drama']::text[],
  'unchanged refresh leaves the stored genres intact');

-- ---------------------------------------------------------------------------
-- STALE-write rejection: a wrong expected_content_hash -> P0005.
-- ---------------------------------------------------------------------------
select throws_ok(
  format($$ select public.refresh_external_media(
       'tmdb', 'movie'::public.media_kind, 'movie:999001', 'Zephyrian Provider Probe',
       null, 'Changed synopsis.', 2020, null, null, 4.0,
       array['Science Fiction']::text[], '{"runtimeMinutes":140}'::jsonb,
       %L, 'v1', %L) $$, repeat('2', 64), repeat('9', 64)),
  'P0005',
  'stale provider refresh',
  'a refresh whose expected_content_hash does not match the stored hash raises P0005');
-- The rejected stale write left the row untouched.
select is(
  (select content_hash from public.media_items where id = (select id from _probe)),
  repeat('1', 64),
  'a rejected stale refresh does not modify content_hash');

-- ---------------------------------------------------------------------------
-- CHANGED refresh: new hash + correct expected hash -> outcome 'changed',
-- fields + provenance advance, identity + user rows preserved.
-- ---------------------------------------------------------------------------
select is(
  (public.refresh_external_media(
     'tmdb', 'movie'::public.media_kind, 'movie:999001', 'Zephyrian Provider Probe',
     null, 'Changed synopsis.', 2020, null, null, 4.0,
     array['Science Fiction']::text[], '{"runtimeMinutes":140}'::jsonb,
     repeat('2', 64), 'v1', repeat('1', 64)
   ) ->> 'outcome'),
  'changed',
  'a new-hash refresh (with a matching expected hash) reports outcome=changed');
select is(
  (select content_hash from public.media_items where id = (select id from _probe)),
  repeat('2', 64),
  'changed refresh advances content_hash to the new payload');
select is(
  (select genres from public.media_items where id = (select id from _probe)),
  array['Science Fiction']::text[],
  'changed refresh replaces the stored genres');
select is(
  (select year from public.media_items where id = (select id from _probe)),
  2020,
  'changed refresh updates the year');
select is(
  (select details ->> 'runtimeMinutes' from public.media_items where id = (select id from _probe)),
  '140',
  'changed refresh updates kind-specific details');
select isnt(
  (select synced_at from public.media_items where id = (select id from _probe)),
  '2000-01-01T00:00:00Z'::timestamptz,
  'changed refresh advances synced_at off the pinned baseline');

-- Identity + alias + user rows preserved by the changed refresh.
select is(
  (select id from public.media_items where source = 'tmdb' and external_id = 'movie:999001'),
  (select id from _probe), 'changed refresh preserves the media id');
select is(
  (select slug from public.media_items where source = 'tmdb' and external_id = 'movie:999001'),
  (select slug from _probe), 'changed refresh preserves the immutable slug');
select is(
  (select id from public.media_external_ids
     where provider = 'tmdb' and kind = 'movie' and external_id = 'movie:999001'),
  (select alias_id from _probe_alias), 'changed refresh preserves the alias row');
select is(
  (select count(*)::int from public.diary_entries where id = 'dddddddd-dddd-dddd-dddd-dddddddddddd'
     and media_id = (select id from _probe) and rating = 4.0),
  1, 'changed refresh preserves the diary entry');
select is(
  (select count(*)::int from public.reviews where id = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'
     and media_id = (select id from _probe)),
  1, 'changed refresh preserves the review');
select is(
  (select count(*)::int from public.favorites where id = 'ffffffff-ffff-ffff-ffff-ffffffffffff'
     and media_id = (select id from _probe)),
  1, 'changed refresh preserves the favorite');
select is(
  (select count(*)::int from public.list_items where id = '66666666-7777-8888-9999-000000000000'
     and media_id = (select id from _probe)),
  1, 'changed refresh preserves the list membership');

-- ---------------------------------------------------------------------------
-- TRANSIENT failure: increments the counter, records the reason, and NEVER
-- removes/hides content or touches provenance.
-- ---------------------------------------------------------------------------
select is(
  (public.mark_external_media_refresh_failed(
     'tmdb', 'movie'::public.media_kind, 'movie:999001', 'upstream 503') ->> 'refresh_failure_count'),
  '1', 'a first transient failure sets refresh_failure_count to 1');
select is(
  (public.mark_external_media_refresh_failed(
     'tmdb', 'movie'::public.media_kind, 'movie:999001', 'network timeout') ->> 'refresh_failure_count'),
  '2', 'a second transient failure increments refresh_failure_count to 2');
select ok(
  (select provider_removed_at is null from public.media_items where id = (select id from _probe)),
  'a transient failure never soft-removes the row');
select is(
  (select content_hash from public.media_items where id = (select id from _probe)),
  repeat('2', 64),
  'a transient failure never touches content_hash');
select is(
  (select last_refresh_error from public.media_items where id = (select id from _probe)),
  'network timeout',
  'a transient failure records the most recent error reason');
-- A subsequent successful (unchanged) refresh clears the failure counter.
select is(
  (public.refresh_external_media(
     'tmdb', 'movie'::public.media_kind, 'movie:999001', 'Zephyrian Provider Probe',
     null, 'Changed synopsis.', 2020, null, null, 4.0,
     array['Science Fiction']::text[], '{"runtimeMinutes":140}'::jsonb,
     repeat('2', 64), 'v1', null
   ) ->> 'outcome'),
  'unchanged',
  'a refresh after failures with the same payload reports unchanged');
select is(
  (select refresh_failure_count from public.media_items where id = (select id from _probe)),
  0, 'a successful refresh resets refresh_failure_count to 0');

-- ---------------------------------------------------------------------------
-- CONFIRMED removal: soft-removes for discovery, preserves media + user rows,
-- and a keyword search no longer returns the row. A transient failure earlier
-- did NOT remove it, proving the two are distinct.
-- ---------------------------------------------------------------------------
-- Present in discovery before removal.
select is(
  (select count(*)::int from public.keyword_search('Zephyrian', 'movie'::public.media_kind, 24)
     where media_id = (select id from _probe)),
  1, 'the provider row is discoverable via keyword_search before removal');

select is(
  (public.mark_external_media_removed('tmdb', 'movie'::public.media_kind, 'movie:999001') ->> 'outcome'),
  'removed', 'mark_external_media_removed reports outcome=removed');
select ok(
  (select provider_removed_at is not null from public.media_items where id = (select id from _probe)),
  'a confirmed removal stamps provider_removed_at');
-- The media row, alias, and every user row survive the removal.
select is(
  (select count(*)::int from public.media_items where id = (select id from _probe)),
  1, 'a confirmed removal does NOT delete the media row');
select is(
  (select count(*)::int from public.media_external_ids
     where provider = 'tmdb' and kind = 'movie' and external_id = 'movie:999001'),
  1, 'a confirmed removal does NOT delete the alias');
select is(
  (select count(*)::int from public.diary_entries where id = 'dddddddd-dddd-dddd-dddd-dddddddddddd'),
  1, 'a confirmed removal preserves the user diary entry');
select is(
  (select count(*)::int from public.reviews where id = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'),
  1, 'a confirmed removal preserves the user review');
-- Hidden from discovery after removal.
select is(
  (select count(*)::int from public.keyword_search('Zephyrian', 'movie'::public.media_kind, 24)
     where media_id = (select id from _probe)),
  0, 'a soft-removed provider row is excluded from keyword_search');

-- ---------------------------------------------------------------------------
-- RESURRECTION: a later successful refresh of a removed row clears the removal
-- and returns it to discovery.
-- ---------------------------------------------------------------------------
select is(
  (public.refresh_external_media(
     'tmdb', 'movie'::public.media_kind, 'movie:999001', 'Zephyrian Provider Probe',
     null, 'Changed synopsis.', 2020, null, null, 4.0,
     array['Science Fiction']::text[], '{"runtimeMinutes":140}'::jsonb,
     repeat('2', 64), 'v1', null
   ) ->> 'outcome'),
  'changed',
  'refreshing a soft-removed row is treated as a change (resurrection)');
select ok(
  (select provider_removed_at is null from public.media_items where id = (select id from _probe)),
  'a resurrection clears provider_removed_at');
select is(
  (select count(*)::int from public.keyword_search('Zephyrian', 'movie'::public.media_kind, 24)
     where media_id = (select id from _probe)),
  1, 'a resurrected provider row is discoverable via keyword_search again');

-- ---------------------------------------------------------------------------
-- CURATED protection: link a TMDB identity to a curated favalog row, then prove
-- none of the operator RPCs can overwrite, fail, or remove the curated row.
-- ---------------------------------------------------------------------------
insert into public.media_items (id, kind, source, external_id, slug, title, synopsis, year, genres)
values (gen_random_uuid(), 'movie'::public.media_kind, 'favalog', 'curated-probe-film',
        'curated-probe-film', 'Curated Probe Film', 'Curated synopsis.', 2001,
        array['Curated']::text[]);

create temporary table _curated_before as
  select id, slug, title, year, genres from public.media_items where slug = 'curated-probe-film';

-- Deterministic candidate link: same normalized title + kind + year -> 'linked'.
select is(
  (public.materialize_external_media(
     'tmdb', 'movie'::public.media_kind, 'movie:999002', 'Curated Probe Film',
     null, 'Provider synopsis.', 2001, null, null, 2.0,
     array['Action']::text[], '{}'::jsonb, repeat('a', 64), 'v1'
   ) ->> 'resolution'),
  'linked',
  'a TMDB identity links to the curated row via the deterministic candidate');

select throws_ok(
  format($$ select public.refresh_external_media(
       'tmdb', 'movie'::public.media_kind, 'movie:999002', 'Curated Probe Film',
       null, 'Provider synopsis.', 2001, null, null, 2.0,
       array['Action']::text[], '{}'::jsonb, %L, 'v1', null) $$, repeat('b', 64)),
  'P0004',
  'curated record is not provider-refreshable',
  'refresh_external_media refuses to refresh a curated-linked identity (P0004)');
select throws_ok(
  $$ select public.mark_external_media_refresh_failed(
       'tmdb', 'movie'::public.media_kind, 'movie:999002', 'boom') $$,
  'P0004',
  'curated record is not provider-refreshable',
  'mark_external_media_refresh_failed refuses a curated-linked identity (P0004)');
select throws_ok(
  $$ select public.mark_external_media_removed(
       'tmdb', 'movie'::public.media_kind, 'movie:999002') $$,
  'P0004',
  'curated record is not provider-refreshable',
  'mark_external_media_removed refuses a curated-linked identity (P0004)');

-- The curated row is byte-for-byte unchanged by the refused operations.
select is(
  (select genres from public.media_items where slug = 'curated-probe-film'),
  (select genres from _curated_before),
  'the curated row genres are never overwritten by the refresh RPCs');
select ok(
  (select provider_removed_at is null from public.media_items where slug = 'curated-probe-film'),
  'the curated row is never soft-removed by the refresh RPCs');

select * from finish();
rollback;
