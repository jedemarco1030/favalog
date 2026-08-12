-- pgTAP: the atomic EDIT/DELETE diary-entry write paths
-- (public.update_diary_entry / public.delete_diary_entry) and the execution
-- grants they rely on.
--
-- Self-contained: creates its own auth users (…1111 Alice / …2222 Bob) inside a
-- transaction that is rolled back, and resolves catalog titles by the stable
-- slugs installed by the forward-only catalog migration. It exercises the same
-- SECURITY INVOKER + auth.uid() ownership model as log_media, and reuses
-- log_media to create the entries it then edits/deletes.
--
-- Run with the local stack: `npm run db:test` (requires Docker + Supabase CLI).

begin;
select plan(35);

-- ---------------------------------------------------------------------------
-- Fixtures: two auth users (profiles created by the trigger).
-- ---------------------------------------------------------------------------
insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data)
values
  ('00000000-0000-0000-0000-000000000000',
   '11111111-1111-1111-1111-111111111111',
   'authenticated', 'authenticated', 'alice_ed@example.com',
   '{"username":"alice_ed","display_name":"Alice"}'),
  ('00000000-0000-0000-0000-000000000000',
   '22222222-2222-2222-2222-222222222222',
   'authenticated', 'authenticated', 'bob_ed@example.com',
   '{"username":"bob_ed","display_name":"Bob"}');

-- ---------------------------------------------------------------------------
-- Execution privileges: authenticated may call, anon may not.
-- ---------------------------------------------------------------------------
select ok(
  has_function_privilege(
    'authenticated',
    'public.update_diary_entry(uuid, timestamp with time zone, numeric, boolean, text, text, boolean)',
    'execute'),
  'authenticated may execute update_diary_entry'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.update_diary_entry(uuid, timestamp with time zone, numeric, boolean, text, text, boolean)',
    'execute'),
  'anon may not execute update_diary_entry'
);
select ok(
  has_function_privilege(
    'authenticated',
    'public.delete_diary_entry(uuid)',
    'execute'),
  'authenticated may execute delete_diary_entry'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.delete_diary_entry(uuid)',
    'execute'),
  'anon may not execute delete_diary_entry'
);

-- ---------------------------------------------------------------------------
-- Act as Alice for the write-path assertions.
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

-- Seed a base entry (no rating, no review) via the create path.
select lives_ok(
  $$ select public.log_media('afterglow', now(), 3.0) $$,
  'setup: Alice logs afterglow with a rating'
);

-- --- UPDATE: change rating and ADD a linked review. ---
select lives_ok(
  $$ select public.update_diary_entry(
       (select de.id from public.diary_entries de
          join public.media_items mi on mi.id = de.media_id
         where de.user_id = '11111111-1111-1111-1111-111111111111' and mi.slug = 'afterglow'),
       now(), 4.5, false, 'First title', 'First pass thoughts.', false) $$,
  'owner can update a diary entry and add a linked review'
);
select is(
  (select de.rating from public.diary_entries de
     join public.media_items mi on mi.id = de.media_id
    where de.user_id = '11111111-1111-1111-1111-111111111111' and mi.slug = 'afterglow'),
  4.5::numeric(2,1),
  'the diary entry stores the updated rating'
);
select is(
  (select r.body from public.reviews r
     join public.media_items mi on mi.id = r.media_id
    where r.user_id = '11111111-1111-1111-1111-111111111111' and mi.slug = 'afterglow'),
  'First pass thoughts.',
  'the added linked review persists its body'
);
select is(
  (select r.rating from public.reviews r
     join public.media_items mi on mi.id = r.media_id
    where r.user_id = '11111111-1111-1111-1111-111111111111' and mi.slug = 'afterglow'),
  null,
  'a diary-linked review stores rating = NULL after add'
);
select is(
  (select count(*)::int from public.reviews r
     join public.diary_entries de on de.id = r.diary_entry_id
     join public.media_items mi on mi.id = de.media_id
    where de.user_id = '11111111-1111-1111-1111-111111111111' and mi.slug = 'afterglow'),
  1,
  'exactly one linked review exists after add'
);

-- --- UPDATE: change the existing linked review's body. ---
select lives_ok(
  $$ select public.update_diary_entry(
       (select de.id from public.diary_entries de
          join public.media_items mi on mi.id = de.media_id
         where de.user_id = '11111111-1111-1111-1111-111111111111' and mi.slug = 'afterglow'),
       now(), 4.5, false, 'Second title', 'Second pass thoughts.', true) $$,
  'owner can update an existing linked review'
);
select is(
  (select r.body from public.reviews r
     join public.media_items mi on mi.id = r.media_id
    where r.user_id = '11111111-1111-1111-1111-111111111111' and mi.slug = 'afterglow'),
  'Second pass thoughts.',
  'the linked review body is updated in place'
);
select is(
  (select count(*)::int from public.reviews r
     join public.diary_entries de on de.id = r.diary_entry_id
     join public.media_items mi on mi.id = de.media_id
    where de.user_id = '11111111-1111-1111-1111-111111111111' and mi.slug = 'afterglow'),
  1,
  'updating a review does not duplicate it'
);

-- --- UPDATE: clear the review body -> the linked review is REMOVED. ---
select lives_ok(
  $$ select public.update_diary_entry(
       (select de.id from public.diary_entries de
          join public.media_items mi on mi.id = de.media_id
         where de.user_id = '11111111-1111-1111-1111-111111111111' and mi.slug = 'afterglow'),
       now(), 4.5, false, null, '   ', false) $$,
  'owner can remove a linked review by clearing its body'
);
select is(
  (select count(*)::int from public.reviews r
     join public.diary_entries de on de.id = r.diary_entry_id
     join public.media_items mi on mi.id = de.media_id
    where de.user_id = '11111111-1111-1111-1111-111111111111' and mi.slug = 'afterglow'),
  0,
  'clearing the body removes the linked review'
);
select is(
  (select count(*)::int from public.diary_entries de
     join public.media_items mi on mi.id = de.media_id
    where de.user_id = '11111111-1111-1111-1111-111111111111' and mi.slug = 'afterglow'),
  1,
  'the diary entry is retained after its review is removed'
);

-- --- UPDATE: remove the rating (pass NULL). ---
select lives_ok(
  $$ select public.update_diary_entry(
       (select de.id from public.diary_entries de
          join public.media_items mi on mi.id = de.media_id
         where de.user_id = '11111111-1111-1111-1111-111111111111' and mi.slug = 'afterglow'),
       now(), null, false) $$,
  'owner can remove an existing rating'
);
select is(
  (select de.rating from public.diary_entries de
     join public.media_items mi on mi.id = de.media_id
    where de.user_id = '11111111-1111-1111-1111-111111111111' and mi.slug = 'afterglow'),
  null,
  'the rating is cleared to NULL'
);

-- --- UPDATE: invalid (non half-star) rating is rejected. ---
select throws_ok(
  $$ select public.update_diary_entry(
       (select de.id from public.diary_entries de
          join public.media_items mi on mi.id = de.media_id
         where de.user_id = '11111111-1111-1111-1111-111111111111' and mi.slug = 'afterglow'),
       now(), 4.3) $$,
  '22023',
  null,
  'a non half-star rating is rejected on update'
);

-- --- UPDATE/DELETE: unknown diary-entry id fails safely. ---
select throws_ok(
  $$ select public.update_diary_entry('00000000-0000-0000-0000-0000000000aa'::uuid, now(), 4.0) $$,
  'P0002',
  null,
  'updating an unknown diary-entry id is rejected'
);
select throws_ok(
  $$ select public.delete_diary_entry('00000000-0000-0000-0000-0000000000aa'::uuid) $$,
  'P0002',
  null,
  'deleting an unknown diary-entry id is rejected'
);

-- --- DELETE: an entry with a linked review is removed with no orphan. ---
select lives_ok(
  $$ select public.log_media('low-country', now(), 5.0, false, 'A note', 'Body to be deleted.', false) $$,
  'setup: Alice logs low-country with a linked review'
);
select lives_ok(
  $$ select public.delete_diary_entry(
       (select de.id from public.diary_entries de
          join public.media_items mi on mi.id = de.media_id
         where de.user_id = '11111111-1111-1111-1111-111111111111' and mi.slug = 'low-country')) $$,
  'owner can delete their diary entry'
);
select is(
  (select count(*)::int from public.diary_entries de
     join public.media_items mi on mi.id = de.media_id
    where de.user_id = '11111111-1111-1111-1111-111111111111' and mi.slug = 'low-country'),
  0,
  'the diary entry is gone after delete'
);
select is(
  (select count(*)::int from public.reviews r
     join public.media_items mi on mi.id = r.media_id
    where r.user_id = '11111111-1111-1111-1111-111111111111' and mi.slug = 'low-country'),
  0,
  'the linked review is removed too (no orphan)'
);

-- --- DELETE: deleting the latest log lets the previous log become latest. ---
select lives_ok(
  $$ select public.log_media('paper-lantern', timestamptz '2020-06-01 12:00', 3.0) $$,
  'setup: Alice logs paper-lantern (older)'
);
select lives_ok(
  $$ select public.log_media('paper-lantern', timestamptz '2021-06-01 12:00', 4.0) $$,
  'setup: Alice logs paper-lantern again (newer)'
);
select lives_ok(
  $$ select public.delete_diary_entry(
       (select de.id from public.diary_entries de
          join public.media_items mi on mi.id = de.media_id
         where de.user_id = '11111111-1111-1111-1111-111111111111' and mi.slug = 'paper-lantern'
         order by de.logged_at desc limit 1)) $$,
  'owner deletes the latest paper-lantern log'
);
select is(
  (select extract(year from de.logged_at)::int from public.diary_entries de
     join public.media_items mi on mi.id = de.media_id
    where de.user_id = '11111111-1111-1111-1111-111111111111' and mi.slug = 'paper-lantern'
    order by de.logged_at desc limit 1),
  2020,
  'the previous log becomes the latest after deleting the newest'
);

-- ---------------------------------------------------------------------------
-- Cross-user: Bob owns an entry Alice must not be able to touch.
-- ---------------------------------------------------------------------------
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
select lives_ok(
  $$ select public.log_media('afterglow', now(), 2.0) $$,
  'setup: Bob logs afterglow'
);

-- Back to Alice: she may read Bob's id (public read) but cannot edit/delete it.
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
select throws_ok(
  $$ select public.update_diary_entry(
       (select de.id from public.diary_entries de
          join public.media_items mi on mi.id = de.media_id
         where de.user_id = '22222222-2222-2222-2222-222222222222' and mi.slug = 'afterglow'),
       now(), 1.0) $$,
  'P0002',
  null,
  'a cross-user update attempt is rejected'
);
select throws_ok(
  $$ select public.delete_diary_entry(
       (select de.id from public.diary_entries de
          join public.media_items mi on mi.id = de.media_id
         where de.user_id = '22222222-2222-2222-2222-222222222222' and mi.slug = 'afterglow')) $$,
  'P0002',
  null,
  'a cross-user delete attempt is rejected'
);
select is(
  (select count(*)::int from public.diary_entries de
     join public.media_items mi on mi.id = de.media_id
    where de.user_id = '22222222-2222-2222-2222-222222222222' and mi.slug = 'afterglow'),
  1,
  'Bob''s entry remains untouched after Alice''s attempts'
);

-- ---------------------------------------------------------------------------
-- Unauthenticated (authenticated role but no auth.uid()) is rejected.
-- ---------------------------------------------------------------------------
set local request.jwt.claims = '{"role":"authenticated"}';
select throws_ok(
  $$ select public.update_diary_entry('00000000-0000-0000-0000-0000000000aa'::uuid, now(), 4.0) $$,
  '28000',
  null,
  'an update without an authenticated identity is rejected'
);
select throws_ok(
  $$ select public.delete_diary_entry('00000000-0000-0000-0000-0000000000aa'::uuid) $$,
  '28000',
  null,
  'a delete without an authenticated identity is rejected'
);

select * from finish();
rollback;
