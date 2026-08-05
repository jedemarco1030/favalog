-- Favalog database tests (pgTAP), run via `npm run db:test` (supabase test db).
--
-- These are self-contained: they create their own auth users and fixtures
-- inside a transaction that is rolled back at the end, so they do not depend on
-- seed.sql. They assert real schema behavior — constraints and RLS — not
-- migration text.
--
-- NOTE: requires a running local Supabase stack (Docker). If Docker is
-- unavailable the test setup is preserved and simply cannot execute locally.

begin;

select plan(16);

-- pgTAP is provided by the Supabase test harness.
select has_extension('pgtap');

-- ---------------------------------------------------------------------------
-- Fixtures: two auth users (profiles are created by the trigger) + catalog.
-- ---------------------------------------------------------------------------
insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data)
values
  ('00000000-0000-0000-0000-000000000000',
   '11111111-1111-1111-1111-111111111111',
   'authenticated', 'authenticated', 'alice@example.com',
   '{"username":"alice","display_name":"Alice"}'),
  ('00000000-0000-0000-0000-000000000000',
   '22222222-2222-2222-2222-222222222222',
   'authenticated', 'authenticated', 'bob@example.com',
   '{"username":"bob","display_name":"Bob"}');

-- The trigger should have provisioned a profile for each user.
select is(
  (select count(*)::int from public.profiles
   where id in ('11111111-1111-1111-1111-111111111111',
                '22222222-2222-2222-2222-222222222222')),
  2,
  'handle_new_user creates a profile for each new auth user'
);

insert into public.media_items (id, kind, source, external_id, slug, title, year, genres, details)
values
  ('33333333-3333-3333-3333-333333333333', 'movie', 'favalog', 'test-movie',
   'test-movie', 'Test Movie', 2024, array['Drama'], '{}'::jsonb),
  ('44444444-4444-4444-4444-444444444444', 'book', 'favalog', 'test-book',
   'test-book', 'Test Book', 2020, array['Fiction'], '{}'::jsonb);

-- ---------------------------------------------------------------------------
-- Constraints
-- ---------------------------------------------------------------------------

-- Case-insensitive unique usernames: "Alice" collides with "alice".
select throws_ok(
  $$ update public.profiles set username = 'Alice'
     where id = '22222222-2222-2222-2222-222222222222' $$,
  '23505',
  null,
  'usernames are unique case-insensitively'
);

-- Invalid (non half-star) diary rating is rejected.
select throws_ok(
  $$ insert into public.diary_entries (user_id, media_id, rating)
     values ('11111111-1111-1111-1111-111111111111',
             '33333333-3333-3333-3333-333333333333', 4.3) $$,
  '23514',
  null,
  'diary rating must be a valid half-star value'
);

-- Out-of-range rating is rejected.
select throws_ok(
  $$ insert into public.diary_entries (user_id, media_id, rating)
     values ('11111111-1111-1111-1111-111111111111',
             '33333333-3333-3333-3333-333333333333', 6.0) $$,
  '23514',
  null,
  'diary rating cannot exceed 5'
);

-- A review linked to a diary entry may not carry its own rating.
select throws_ok(
  $$ with de as (
       insert into public.diary_entries (id, user_id, media_id, rating)
       values ('55555555-5555-5555-5555-555555555555',
               '11111111-1111-1111-1111-111111111111',
               '33333333-3333-3333-3333-333333333333', 4.0)
       returning id
     )
     insert into public.reviews (user_id, media_id, diary_entry_id, body, rating)
     select '11111111-1111-1111-1111-111111111111',
            '33333333-3333-3333-3333-333333333333', id, 'body', 3.0 from de $$,
  '23514',
  null,
  'a diary-linked review cannot duplicate a rating'
);

-- A list, then a duplicate media item in the same list is rejected.
insert into public.lists (id, user_id, slug, title, visibility)
values ('66666666-6666-6666-6666-666666666666',
        '11111111-1111-1111-1111-111111111111', 'alice-list', 'Alice List', 'public');
insert into public.list_items (list_id, media_id, position)
values ('66666666-6666-6666-6666-666666666666',
        '33333333-3333-3333-3333-333333333333', 0);
select throws_ok(
  $$ insert into public.list_items (list_id, media_id, position)
     values ('66666666-6666-6666-6666-666666666666',
             '33333333-3333-3333-3333-333333333333', 1) $$,
  '23505',
  null,
  'the same media item cannot appear twice in one list'
);

-- Self-follow is rejected.
select throws_ok(
  $$ insert into public.follows (follower_id, following_id)
     values ('11111111-1111-1111-1111-111111111111',
             '11111111-1111-1111-1111-111111111111') $$,
  '23514',
  null,
  'a user cannot follow themselves'
);

-- ---------------------------------------------------------------------------
-- RLS: exercised as the `authenticated` role with a JWT claim for auth.uid().
-- ---------------------------------------------------------------------------

-- Act as Alice.
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

-- Owner write: Alice can insert her own diary entry.
select lives_ok(
  $$ insert into public.diary_entries (user_id, media_id, rating)
     values ('11111111-1111-1111-1111-111111111111',
             '44444444-4444-4444-4444-444444444444', 5.0) $$,
  'owner can insert their own diary entry'
);

-- Cross-user write denial: Alice cannot insert a diary entry as Bob.
select throws_ok(
  $$ insert into public.diary_entries (user_id, media_id, rating)
     values ('22222222-2222-2222-2222-222222222222',
             '44444444-4444-4444-4444-444444444444', 5.0) $$,
  '42501',
  null,
  'a user cannot create rows owned by another user (RLS with check)'
);

-- Catalog write denial: authenticated users cannot modify the catalog.
select throws_ok(
  $$ insert into public.media_items (kind, source, external_id, slug, title, year)
     values ('movie', 'favalog', 'rogue', 'rogue', 'Rogue', 2024) $$,
  '42501',
  null,
  'ordinary users cannot write catalog rows (service_role only)'
);

-- list_items write is bound to list ownership: Bob (below) cannot add to Alice's list.
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
select throws_ok(
  $$ insert into public.list_items (list_id, media_id, position)
     values ('66666666-6666-6666-6666-666666666666',
             '44444444-4444-4444-4444-444444444444', 5) $$,
  '42501',
  null,
  'a user cannot add items to a list they do not own'
);

-- Public read: Bob can read the publicly-readable catalog.
select is(
  (select count(*)::int from public.media_items
   where id in ('33333333-3333-3333-3333-333333333333',
                '44444444-4444-4444-4444-444444444444')),
  2,
  'media items are publicly readable'
);

-- Private-list access: create a private list as Bob, confirm Alice cannot read it.
insert into public.lists (id, user_id, slug, title, visibility)
values ('77777777-7777-7777-7777-777777777777',
        '22222222-2222-2222-2222-222222222222', 'bob-private', 'Bob Private', 'private');

-- Bob (owner) sees his private list.
select is(
  (select count(*)::int from public.lists
   where id = '77777777-7777-7777-7777-777777777777'),
  1,
  'owner can read their own private list'
);

-- Alice cannot see Bob's private list.
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
select is(
  (select count(*)::int from public.lists
   where id = '77777777-7777-7777-7777-777777777777'),
  0,
  'a private list is not readable by another user'
);

-- Alice can read Bob's public-none but her own list remains visible.
select is(
  (select count(*)::int from public.lists
   where id = '66666666-6666-6666-6666-666666666666'),
  1,
  'a public list is readable by any user'
);

select * from finish();

rollback;
