-- pgTAP: the persistent list write paths (public.create_list, add_list_item,
-- remove_list_item), their server-generated global slugs, position behavior,
-- RLS read visibility, and authenticated-only grants.
--
-- Self-contained: creates its own auth users (…1111 Alice / …2222 Bob) inside a
-- transaction that is rolled back, and resolves catalog titles by the stable
-- slugs installed by the catalog migration (20260806160100). Does NOT depend on
-- seed.sql.
--
-- Run with the local stack: `npm run db:test` (requires Docker + Supabase CLI).

begin;
select plan(40);

-- ---------------------------------------------------------------------------
-- Fixtures: two auth users (profiles created by the trigger).
-- ---------------------------------------------------------------------------
insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data)
values
  ('00000000-0000-0000-0000-000000000000',
   '11111111-1111-1111-1111-111111111111',
   'authenticated', 'authenticated', 'alice_list@example.com',
   '{"username":"alice_rpc","display_name":"Alice"}'),
  ('00000000-0000-0000-0000-000000000000',
   '22222222-2222-2222-2222-222222222222',
   'authenticated', 'authenticated', 'bob_list@example.com',
   '{"username":"bob_rpc","display_name":"Bob"}');

-- ---------------------------------------------------------------------------
-- Execution privileges: authenticated may call, anon may not.
-- ---------------------------------------------------------------------------
select ok(
  has_function_privilege('authenticated',
    'public.create_list(text, text, boolean, text, text)', 'execute'),
  'authenticated may execute create_list');
select ok(
  not has_function_privilege('anon',
    'public.create_list(text, text, boolean, text, text)', 'execute'),
  'anon may not execute create_list');
select ok(
  has_function_privilege('authenticated',
    'public.add_list_item(uuid, text)', 'execute'),
  'authenticated may execute add_list_item');
select ok(
  not has_function_privilege('anon',
    'public.add_list_item(uuid, text)', 'execute'),
  'anon may not execute add_list_item');
select ok(
  has_function_privilege('authenticated',
    'public.remove_list_item(uuid, text)', 'execute'),
  'authenticated may execute remove_list_item');
select ok(
  not has_function_privilege('anon',
    'public.remove_list_item(uuid, text)', 'execute'),
  'anon may not execute remove_list_item');

-- ---------------------------------------------------------------------------
-- Act as Alice for the write-path assertions.
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

-- Create a public list.
select lives_ok(
  $$ select public.create_list('My Films', 'A short canon.', true, 'public') $$,
  'authenticated user can create a public list');

-- Slug is generated server-side (username + title) and appears exactly once.
select is(
  (select count(*)::int from public.lists where slug = 'alice-rpc-my-films'),
  1,
  'create_list generates a server-side slug from username + title');

-- The list is owned by the caller and public.
select is(
  (select count(*)::int from public.lists
    where slug = 'alice-rpc-my-films'
      and user_id = '11111111-1111-1111-1111-111111111111'
      and visibility = 'public'),
  1,
  'the created list is owned by the caller and public');

-- Create a private list.
select lives_ok(
  $$ select public.create_list('Secret Shelf', null, false, 'private') $$,
  'authenticated user can create a private list');
select is(
  (select visibility::text from public.lists where slug = 'alice-rpc-secret-shelf'),
  'private',
  'the private list stores private visibility');

-- Duplicate title generates a collision-safe slug.
select lives_ok(
  $$ select public.create_list('My Films', null, false, 'public') $$,
  'a duplicate title is accepted (collision-safe slug)');
select is(
  (select count(*)::int from public.lists where slug = 'alice-rpc-my-films-2'),
  1,
  'a duplicate title gets a deterministic -2 suffix');
select is(
  (select (count(*) = count(distinct slug)) from public.lists),
  true,
  'all list slugs are globally unique');

-- Add a catalog title to the public list.
select lives_ok(
  $$ select public.add_list_item(
       (select id from public.lists where slug = 'alice-rpc-my-films'),
       'afterglow') $$,
  'owner can add a catalog title to their list');
select is(
  (select position from public.list_items li
     join public.lists l on l.id = li.list_id
     join public.media_items mi on mi.id = li.media_id
    where l.slug = 'alice-rpc-my-films' and mi.slug = 'afterglow'),
  0,
  'the first added title is at position 0');

-- Adding the same title again is idempotent (no duplicate).
select lives_ok(
  $$ select public.add_list_item(
       (select id from public.lists where slug = 'alice-rpc-my-films'),
       'afterglow') $$,
  'adding an already-present title does not error');
select is(
  (select count(*)::int from public.list_items li
     join public.lists l on l.id = li.list_id
     join public.media_items mi on mi.id = li.media_id
    where l.slug = 'alice-rpc-my-films' and mi.slug = 'afterglow'),
  1,
  'adding the same title twice does not duplicate it');

-- Append two more titles; positions stay contiguous.
select lives_ok(
  $$ select public.add_list_item(
       (select id from public.lists where slug = 'alice-rpc-my-films'),
       'paper-lantern') $$,
  'owner can append a second title');
select lives_ok(
  $$ select public.add_list_item(
       (select id from public.lists where slug = 'alice-rpc-my-films'),
       'low-country') $$,
  'owner can append a third title');
select is(
  (select array_agg(position order by position)
     from public.list_items li
     join public.lists l on l.id = li.list_id
    where l.slug = 'alice-rpc-my-films'),
  array[0, 1, 2],
  'appended positions remain valid and contiguous');

-- Remove the middle title; positions compact.
select lives_ok(
  $$ select public.remove_list_item(
       (select id from public.lists where slug = 'alice-rpc-my-films'),
       'paper-lantern') $$,
  'owner can remove a title');
select is(
  (select array_agg(position order by position)
     from public.list_items li
     join public.lists l on l.id = li.list_id
    where l.slug = 'alice-rpc-my-films'),
  array[0, 1],
  'removal compacts remaining positions to a contiguous range');

-- Parent updated_at is bumped by a membership mutation. now() is fixed within a
-- transaction, so age the row via a superuser trigger-bypassing update, then
-- prove a subsequent add refreshes it.
reset role;
alter table public.lists disable trigger lists_set_updated_at;
update public.lists set updated_at = timestamptz '2000-01-01 00:00:00+00'
  where slug = 'alice-rpc-my-films';
alter table public.lists enable trigger lists_set_updated_at;
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
select public.add_list_item(
  (select id from public.lists where slug = 'alice-rpc-my-films'),
  'dune-part-two');
select ok(
  (select updated_at from public.lists where slug = 'alice-rpc-my-films')
    > timestamptz '2000-01-01 00:00:00+00',
  'a membership mutation bumps the parent list updated_at');

-- Failure cases (still Alice).
select throws_ok(
  $$ select public.add_list_item(
       (select id from public.lists where slug = 'alice-rpc-my-films'),
       'this-slug-does-not-exist') $$,
  'P0002', null,
  'adding an unknown media slug fails safely');
select throws_ok(
  $$ select public.add_list_item(
       '00000000-0000-0000-0000-0000000000aa'::uuid, 'afterglow') $$,
  'P0002', null,
  'adding to an unknown list id fails safely');
select throws_ok(
  $$ select public.remove_list_item(
       (select id from public.lists where slug = 'alice-rpc-my-films'),
       'this-slug-does-not-exist') $$,
  'P0002', null,
  'removing an unknown media slug fails safely');
select throws_ok(
  $$ select public.create_list('Bad Visibility', null, false, 'followers') $$,
  '22023', null,
  'creating with a non-public/private visibility is rejected');
select throws_ok(
  $$ select public.create_list('   ', null, false, 'public') $$,
  '22023', null,
  'creating with an empty title is rejected');

-- Owner can read their own private list.
select is(
  (select count(*)::int from public.lists where slug = 'alice-rpc-secret-shelf'),
  1,
  'owner can read their own private list');

-- ---------------------------------------------------------------------------
-- Act as Bob (a different authenticated user).
-- ---------------------------------------------------------------------------
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';

-- Private lists (and their items) are hidden from non-owners.
select is(
  (select count(*)::int from public.lists where slug = 'alice-rpc-secret-shelf'),
  0,
  'a private list is hidden from a non-owner');
select is(
  (select count(*)::int from public.list_items li
     join public.lists l on l.id = li.list_id
    where l.visibility = 'private'),
  0,
  'private list items are hidden from a non-owner');

-- Cross-user add / remove attempts fail (list not owned by caller).
select throws_ok(
  $$ select public.add_list_item(
       (select id from public.lists l where l.user_id = '11111111-1111-1111-1111-111111111111' and l.slug = 'alice-rpc-my-films'),
       'salt-tide') $$,
  'P0002', null,
  'a cross-user add attempt fails');
select throws_ok(
  $$ select public.remove_list_item(
       (select id from public.lists l where l.user_id = '11111111-1111-1111-1111-111111111111' and l.slug = 'alice-rpc-my-films'),
       'afterglow') $$,
  'P0002', null,
  'a cross-user remove attempt fails');

-- ---------------------------------------------------------------------------
-- Act as anon: public reads work, but writes are rejected by the grant.
-- ---------------------------------------------------------------------------
set local role anon;
set local request.jwt.claims = '{}';

select is(
  (select count(*)::int from public.lists where slug = 'alice-rpc-my-films'),
  1,
  'a public list is readable by a signed-out visitor');
select is(
  (select count(*)::int from public.list_items li
     join public.lists l on l.id = li.list_id
    where l.slug = 'alice-rpc-my-films'),
  3,
  'public list items are readable by a signed-out visitor');

select throws_ok(
  $$ select public.create_list('Nope', null, false, 'public') $$,
  '42501', null,
  'anonymous list creation is rejected by the grant');
select throws_ok(
  $$ select public.add_list_item('00000000-0000-0000-0000-0000000000aa'::uuid, 'afterglow') $$,
  '42501', null,
  'anonymous add is rejected by the grant');
select throws_ok(
  $$ select public.remove_list_item('00000000-0000-0000-0000-0000000000aa'::uuid, 'afterglow') $$,
  '42501', null,
  'anonymous remove is rejected by the grant');

-- ---------------------------------------------------------------------------
-- In-function guard: authenticated role with no auth.uid() is rejected.
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"role":"authenticated"}';
select throws_ok(
  $$ select public.create_list('No Identity', null, false, 'public') $$,
  '28000', null,
  'create_list without an authenticated identity is rejected');

select * from finish();
rollback;
