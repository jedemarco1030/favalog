-- pgTAP: the following-feed read path (public.get_following_feed) — its
-- authorization model, follow direction, self/non-followed exclusion, RLS
-- preservation, linked-review deduplication, edit/delete behaviour, stable
-- total ordering with identical timestamps, cursor validation, keyset
-- pagination, and revocation across pages.
--
-- Self-contained: creates its own auth users (Alice, Bob, Carol), catalog rows,
-- and activity inside a transaction that is rolled back.
--
-- Run with the local stack: `npm run db:test` (requires Docker + Supabase CLI).

begin;
select plan(38);

-- ---------------------------------------------------------------------------
-- Fixtures: three auth users (profiles created by the trigger).
--   Alice  = the followed actor
--   Bob    = the viewer (follows Alice only)
--   Carol  = an unrelated, non-followed actor
-- ---------------------------------------------------------------------------
insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data)
values
  ('00000000-0000-0000-0000-000000000000',
   'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   'authenticated', 'authenticated', 'alice_feed@example.com',
   '{"username":"alice_feed","display_name":"Alice Feed"}'),
  ('00000000-0000-0000-0000-000000000000',
   'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
   'authenticated', 'authenticated', 'bob_feed@example.com',
   '{"username":"bob_feed","display_name":"Bob Feed"}'),
  ('00000000-0000-0000-0000-000000000000',
   'cccccccc-cccc-cccc-cccc-cccccccccccc',
   'authenticated', 'authenticated', 'carol_feed@example.com',
   '{"username":"carol_feed","display_name":"Carol Feed"}');

-- Catalog rows.
insert into public.media_items (id, kind, source, external_id, slug, title, year, poster_url)
values
  ('10000000-0000-0000-0000-000000000001', 'movie', 'favalog', 'feed-title-one',
   'feed-title-one', 'Feed Title One', 2020, 'https://example.com/one.jpg'),
  ('10000000-0000-0000-0000-000000000002', 'book', 'favalog', 'feed-title-two',
   'feed-title-two', 'Feed Title Two', 2019, 'https://example.com/two.jpg');

-- Alice's activity.
--   d1  2026-01-01 — diary entry with a LINKED review (one combined item)
--   rv2 2026-01-02 — standalone review
--   d3  2026-01-03 — diary entry, identical timestamp to rv3
--   rv3 2026-01-03 — standalone review, identical timestamp to d3
insert into public.diary_entries (id, user_id, media_id, logged_at, rating, is_revisit, created_at)
values
  ('d1d1d1d1-0000-0000-0000-000000000001',
   'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   '10000000-0000-0000-0000-000000000001',
   timestamptz '2025-12-20 12:00:00+00', 4.0, false,
   timestamptz '2026-01-01 10:00:00+00'),
  ('d3d3d3d3-0000-0000-0000-000000000003',
   'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   '10000000-0000-0000-0000-000000000002',
   timestamptz '2026-01-03 10:00:00+00', 5.0, true,
   timestamptz '2026-01-03 10:00:00+00');

insert into public.reviews (id, user_id, media_id, diary_entry_id, title, body, rating, contains_spoilers, created_at)
values
  ('e1e1e1e1-0000-0000-0000-000000000001',
   'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   '10000000-0000-0000-0000-000000000001',
   'd1d1d1d1-0000-0000-0000-000000000001',
   'Linked review', 'A linked review body.', null, true,
   timestamptz '2026-01-01 10:00:00+00'),
  ('e2e2e2e2-0000-0000-0000-000000000002',
   'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   '10000000-0000-0000-0000-000000000002',
   null,
   'Standalone review', 'A standalone review body.', 3.5, false,
   timestamptz '2026-01-02 10:00:00+00'),
  ('e3e3e3e3-0000-0000-0000-000000000003',
   'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   '10000000-0000-0000-0000-000000000001',
   null,
   'Tie review', 'A tie-breaking standalone review body.', 2.0, false,
   timestamptz '2026-01-03 10:00:00+00');

-- Carol's unrelated activity (Bob does not follow Carol).
insert into public.diary_entries (id, user_id, media_id, created_at)
values
  ('c4c4c4c4-0000-0000-0000-000000000004',
   'cccccccc-cccc-cccc-cccc-cccccccccccc',
   '10000000-0000-0000-0000-000000000001',
   timestamptz '2026-02-01 10:00:00+00');

-- Bob's own activity (must never appear in his own feed).
insert into public.diary_entries (id, user_id, media_id, created_at)
values
  ('b5b5b5b5-0000-0000-0000-000000000005',
   'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
   '10000000-0000-0000-0000-000000000002',
   timestamptz '2026-02-02 10:00:00+00');

-- Bob follows Alice (only).
insert into public.follows (follower_id, following_id)
values ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');

-- ---------------------------------------------------------------------------
-- Execution privileges: authenticated may call; anon / public may not.
-- ---------------------------------------------------------------------------
select ok(
  has_function_privilege('authenticated',
    'public.get_following_feed(int, timestamptz, text, uuid)', 'execute'),
  'authenticated may execute get_following_feed');
select ok(
  not has_function_privilege('anon',
    'public.get_following_feed(int, timestamptz, text, uuid)', 'execute'),
  'anon may not execute get_following_feed');
select ok(
  not has_function_privilege('public',
    'public.get_following_feed(int, timestamptz, text, uuid)', 'execute'),
  'public may not execute get_following_feed');

-- ---------------------------------------------------------------------------
-- Security configuration: SECURITY INVOKER, pinned empty search_path, and no
-- caller-selected viewer id among the arguments.
-- ---------------------------------------------------------------------------
select is(
  (select prosecdef from pg_proc
    where oid = 'public.get_following_feed(int, timestamptz, text, uuid)'::regprocedure),
  false,
  'get_following_feed is SECURITY INVOKER');
select ok(
  (select proconfig from pg_proc
    where oid = 'public.get_following_feed(int, timestamptz, text, uuid)'::regprocedure)
    @> array['search_path=""'],
  'get_following_feed pins search_path to empty');
select is(
  (select pronargs from pg_proc
    where oid = 'public.get_following_feed(int, timestamptz, text, uuid)'::regprocedure)::int,
  4,
  'get_following_feed takes exactly four args (limit + three cursor parts)');
select is(
  (select proargnames[1:4] from pg_proc
    where oid = 'public.get_following_feed(int, timestamptz, text, uuid)'::regprocedure),
  array['p_limit', 'p_cursor_created_at', 'p_cursor_source', 'p_cursor_id'],
  'get_following_feed accepts no caller-selected viewer id');

-- ---------------------------------------------------------------------------
-- Anonymous rejection.
-- ---------------------------------------------------------------------------
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';
select throws_ok(
  $$ select * from public.get_following_feed() $$,
  '42501',
  null,
  'anonymous caller is rejected by privilege revoke');

-- ---------------------------------------------------------------------------
-- Act as Bob, the viewer.
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb","role":"authenticated"}';

select is(
  (select count(*)::int from public.get_following_feed()),
  4,
  'Bob sees exactly four items: the combined diary+review, and three others');

-- Deduplication: the linked review never becomes a second item.
select is(
  (select count(*)::int from public.get_following_feed() f
    where f.activity_id = 'e1e1e1e1-0000-0000-0000-000000000001'),
  0,
  'a diary-linked review does not produce a separate feed item');
select is(
  (select count(*)::int from public.get_following_feed() f
    where f.activity_id = 'd1d1d1d1-0000-0000-0000-000000000001'
      and f.source = 'diary'
      and f.review_id = 'e1e1e1e1-0000-0000-0000-000000000001'
      and f.review_body = 'A linked review body.'
      and f.contains_spoilers
      and f.rating = 4.0),
  1,
  'the diary entry and its linked review render as ONE combined item with the diary rating');

-- The standalone review is its own item and keeps its own rating.
select is(
  (select count(*)::int from public.get_following_feed() f
    where f.activity_id = 'e2e2e2e2-0000-0000-0000-000000000002'
      and f.source = 'review'
      and f.rating = 3.5
      and f.logged_at is null),
  1,
  'a standalone review is its own feed item');

-- Exclusions.
select is(
  (select count(*)::int from public.get_following_feed() f
    where f.activity_id = 'c4c4c4c4-0000-0000-0000-000000000004'),
  0,
  'a non-followed user''s activity is excluded');
select is(
  (select count(*)::int from public.get_following_feed() f
    where f.activity_id = 'b5b5b5b5-0000-0000-0000-000000000005'),
  0,
  'the viewer''s own activity is excluded');

-- Public identity and canonical media references only.
select is(
  (select array_agg(distinct f.actor_username) from public.get_following_feed() f),
  array['alice_feed'],
  'only the followed actor''s public identity is returned');
select is(
  (select count(*)::int from public.get_following_feed() f
    where f.media_slug in ('feed-title-one', 'feed-title-two')
      and f.media_kind in ('movie', 'book')
      and f.media_year between 2019 and 2020),
  4,
  'canonical media references are returned for every item');

-- Stable total order, including the identical-timestamp tie (diary before review).
select is(
  (select array_agg(f.source) from (
     select * from public.get_following_feed()
   ) f),
  array['diary', 'review', 'review', 'diary'],
  'ordering is newest-first with diary ahead of review on identical timestamps');
select is(
  (select f.activity_id from public.get_following_feed() f limit 1),
  'd3d3d3d3-0000-0000-0000-000000000003'::uuid,
  'the newest diary entry wins the identical-timestamp tie');

-- ---------------------------------------------------------------------------
-- Follow direction: Alice follows nobody, so she sees nothing.
-- ---------------------------------------------------------------------------
set local request.jwt.claims = '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}';
select is(
  (select count(*)::int from public.get_following_feed()),
  0,
  'Alice does not see Bob''s feed: following is directed, not mutual');

-- ---------------------------------------------------------------------------
-- Cursor validation and limit clamping (back as Bob).
-- ---------------------------------------------------------------------------
set local request.jwt.claims = '{"sub":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb","role":"authenticated"}';

select throws_ok(
  $$ select * from public.get_following_feed(20, timestamptz '2026-01-03 10:00:00+00', null, null) $$,
  '22023',
  'invalid feed cursor',
  'a partial cursor is rejected with 22023');
select throws_ok(
  $$ select * from public.get_following_feed(
       20,
       timestamptz '2026-01-03 10:00:00+00',
       'list',
       'd3d3d3d3-0000-0000-0000-000000000003') $$,
  '22023',
  null,
  'an unknown cursor source is rejected with 22023');

select is(
  (select count(*)::int from public.get_following_feed(0)),
  1,
  'a zero limit is clamped up to one');
select is(
  (select count(*)::int from public.get_following_feed(100000)),
  4,
  'an absurd limit is clamped to the server maximum');
select is(
  (select count(*)::int from public.get_following_feed(null)),
  4,
  'a null limit falls back to the default page size');

-- ---------------------------------------------------------------------------
-- Keyset pagination: no duplicates, no skips, tie-safe across source types.
-- ---------------------------------------------------------------------------
select is(
  (select array_agg(f.activity_id) from (
     select * from public.get_following_feed(2)
   ) f),
  array['d3d3d3d3-0000-0000-0000-000000000003',
        'e3e3e3e3-0000-0000-0000-000000000003']::uuid[],
  'page one returns the first two items in total order');

select is(
  (select array_agg(f.activity_id) from (
     select * from public.get_following_feed(
       2,
       timestamptz '2026-01-03 10:00:00+00',
       'review',
       'e3e3e3e3-0000-0000-0000-000000000003')
   ) f),
  array['e2e2e2e2-0000-0000-0000-000000000002',
        'd1d1d1d1-0000-0000-0000-000000000001']::uuid[],
  'page two continues after the cursor with no duplicates and no skips');

select is(
  (select array_agg(f.activity_id) from (
     select * from public.get_following_feed(
       1,
       timestamptz '2026-01-03 10:00:00+00',
       'diary',
       'd3d3d3d3-0000-0000-0000-000000000003')
   ) f),
  array['e3e3e3e3-0000-0000-0000-000000000003']::uuid[],
  'the seek breaks an identical-timestamp tie correctly across source types');

select is(
  (select count(*)::int from public.get_following_feed(
     20,
     timestamptz '2026-01-01 10:00:00+00',
     'diary',
     'd1d1d1d1-0000-0000-0000-000000000001')),
  0,
  'a cursor past the oldest item returns the end of the feed');

-- ---------------------------------------------------------------------------
-- RLS is preserved as an independent boundary: following grants feed
-- selection, never write privilege over the followed user's records.
-- ---------------------------------------------------------------------------
update public.diary_entries
set rating = 1.0
where id = 'd1d1d1d1-0000-0000-0000-000000000001';
select is(
  (select de.rating from public.diary_entries de
    where de.id = 'd1d1d1d1-0000-0000-0000-000000000001'),
  4.0,
  'Bob cannot edit Alice''s diary entry just because he follows her');

delete from public.reviews
where id = 'e2e2e2e2-0000-0000-0000-000000000002';
select is(
  (select count(*)::int from public.reviews
    where id = 'e2e2e2e2-0000-0000-0000-000000000002'),
  1,
  'Bob cannot delete Alice''s review just because he follows her');

-- ---------------------------------------------------------------------------
-- Edit does not bump position; delete removes the item (as Alice, the owner).
-- ---------------------------------------------------------------------------
set local request.jwt.claims = '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}';
select public.update_diary_entry(
  'd1d1d1d1-0000-0000-0000-000000000001',
  timestamptz '2025-12-20 12:00:00+00',
  2.5,
  false,
  'Linked review',
  'An edited linked review body.',
  true
);

set local request.jwt.claims = '{"sub":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb","role":"authenticated"}';
select is(
  (select array_agg(f.activity_id) from (
     select * from public.get_following_feed(
       2,
       timestamptz '2026-01-03 10:00:00+00',
       'review',
       'e3e3e3e3-0000-0000-0000-000000000003')
   ) f),
  array['e2e2e2e2-0000-0000-0000-000000000002',
        'd1d1d1d1-0000-0000-0000-000000000001']::uuid[],
  'an edited entry keeps its position: created_at is never bumped');
select is(
  (select count(*)::int from public.get_following_feed() f
    where f.activity_id = 'd1d1d1d1-0000-0000-0000-000000000001'
      and f.rating = 2.5
      and f.review_body = 'An edited linked review body.'),
  1,
  'the edited content is reflected immediately — no stale excerpt is retained');

-- Alice deletes the combined entry; it and its linked review vanish.
set local request.jwt.claims = '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}';
select public.delete_diary_entry('d1d1d1d1-0000-0000-0000-000000000001');

set local request.jwt.claims = '{"sub":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb","role":"authenticated"}';
select is(
  (select count(*)::int from public.get_following_feed()),
  3,
  'a deleted diary entry and its linked review disappear from the feed');
select is(
  (select count(*)::int from public.get_following_feed() f
    where f.review_id = 'e1e1e1e1-0000-0000-0000-000000000001'),
  0,
  'the deleted entry''s review leaves no orphaned feed item');

-- A review whose diary entry was detached (FK ON DELETE SET NULL) becomes a
-- standalone item rather than disappearing.
set local role postgres;
insert into public.diary_entries (id, user_id, media_id, created_at)
values ('d6d6d6d6-0000-0000-0000-000000000006',
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        '10000000-0000-0000-0000-000000000001',
        timestamptz '2026-01-04 10:00:00+00');
insert into public.reviews (id, user_id, media_id, diary_entry_id, body, contains_spoilers, created_at)
values ('e6e6e6e6-0000-0000-0000-000000000006',
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        '10000000-0000-0000-0000-000000000001',
        'd6d6d6d6-0000-0000-0000-000000000006',
        'A detached review body.', false,
        timestamptz '2026-01-04 10:00:00+00');
delete from public.diary_entries where id = 'd6d6d6d6-0000-0000-0000-000000000006';

set local role authenticated;
set local request.jwt.claims = '{"sub":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb","role":"authenticated"}';
select is(
  (select count(*)::int from public.get_following_feed() f
    where f.activity_id = 'e6e6e6e6-0000-0000-0000-000000000006'
      and f.source = 'review'),
  1,
  'a review detached by diary-entry deletion becomes a standalone feed item');

-- ---------------------------------------------------------------------------
-- Revocation across pages: unfollowing between page one and page two removes
-- the actor from the next page. The cursor is never an authorization.
-- ---------------------------------------------------------------------------
select is(
  (select count(*)::int from public.get_following_feed(2)),
  2,
  'page one is served while Bob still follows Alice');

select public.set_follow('alice_feed', false);

select is(
  (select count(*)::int from public.get_following_feed(
     2,
     timestamptz '2026-01-03 10:00:00+00',
     'review',
     'e3e3e3e3-0000-0000-0000-000000000003')),
  0,
  'unfollowing between pages removes the actor from the next page');
select is(
  (select count(*)::int from public.get_following_feed()),
  0,
  'after unfollowing, the feed is empty');

select * from finish();
rollback;
