-- pgTAP: the persistent follow lifecycle write path (public.set_follow),
-- its idempotency, self-follow rejection, target validation, directional relationships,
-- and authenticated-only privileges.
--
-- Self-contained: creates its own auth users (Alice, Bob, Carol) inside a
-- transaction that is rolled back.
--
-- Run with the local stack: `npm run db:test` (requires Docker + Supabase CLI).

begin;
select plan(26);

-- ---------------------------------------------------------------------------
-- Fixtures: three auth users (profiles created by the trigger).
-- ---------------------------------------------------------------------------
insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data)
values
  ('00000000-0000-0000-0000-000000000000',
   '11111111-1111-1111-1111-111111111111',
   'authenticated', 'authenticated', 'alice_flw@example.com',
   '{"username":"alice_flw","display_name":"Alice"}'),
  ('00000000-0000-0000-0000-000000000000',
   '22222222-2222-2222-2222-222222222222',
   'authenticated', 'authenticated', 'bob_flw@example.com',
   '{"username":"bob_flw","display_name":"Bob"}'),
  ('00000000-0000-0000-0000-000000000000',
   '33333333-3333-3333-3333-333333333333',
   'authenticated', 'authenticated', 'carol_flw@example.com',
   '{"username":"carol_flw","display_name":"Carol"}');

-- ---------------------------------------------------------------------------
-- Execution privileges: authenticated may call; anon / public may not.
-- ---------------------------------------------------------------------------
select ok(
  has_function_privilege('authenticated',
    'public.set_follow(text, boolean)', 'execute'),
  'authenticated may execute set_follow');
select ok(
  not has_function_privilege('anon',
    'public.set_follow(text, boolean)', 'execute'),
  'anon may not execute set_follow');
select ok(
  not has_function_privilege('public',
    'public.set_follow(text, boolean)', 'execute'),
  'public may not execute set_follow');

-- ---------------------------------------------------------------------------
-- Security configuration: SECURITY INVOKER, pinned empty search_path,
-- taking target username + desired boolean.
-- ---------------------------------------------------------------------------
select is(
  (select prosecdef from pg_proc
    where oid = 'public.set_follow(text, boolean)'::regprocedure),
  false,
  'set_follow is SECURITY INVOKER');
select ok(
  (select proconfig from pg_proc
    where oid = 'public.set_follow(text, boolean)'::regprocedure)
    @> array['search_path=""'],
  'set_follow pins search_path to empty');
select is(
  (select pronargs from pg_proc
    where oid = 'public.set_follow(text, boolean)'::regprocedure)::int,
  2,
  'set_follow takes exactly two args (target_username, is_follow)');

-- ---------------------------------------------------------------------------
-- Anonymous rejection (unauthenticated call).
-- ---------------------------------------------------------------------------
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';
select throws_ok(
  $$ select public.set_follow('bob_flw', true) $$,
  '42501',
  null,
  'anonymous caller is rejected by privilege revoke');

-- ---------------------------------------------------------------------------
-- Act as Alice for write-path assertions.
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

-- Input validation: null desired state rejected.
select throws_ok(
  $$ select public.set_follow('bob_flw', null) $$,
  '22023',
  'invalid follow state',
  'null desired state is rejected with 22023');

-- Input validation: malformed username rejected.
select throws_ok(
  $$ select public.set_follow('ab', true) $$,
  '22023',
  null,
  'short username is rejected with 22023');
select throws_ok(
  $$ select public.set_follow('invalid-user!', true) $$,
  '22023',
  null,
  'invalid character username is rejected with 22023');

-- Missing target profile rejected.
select throws_ok(
  $$ select public.set_follow('nonexistent_user', true) $$,
  'P0002',
  null,
  'nonexistent target profile is rejected with P0002');

-- Self-follow rejected.
select throws_ok(
  $$ select public.set_follow('alice_flw', true) $$,
  '22023',
  'cannot follow self',
  'self-follow is rejected with 22023');

-- Alice follows Bob (first follow).
select is(
  (select public.set_follow('bob_flw', true)),
  jsonb_build_object(
    'target_username', 'bob_flw',
    'target_user_id', '22222222-2222-2222-2222-222222222222',
    'is_following', true,
    'changed', true
  ),
  'Alice following Bob returns target details, is_following=true, and changed=true');

-- Verify row in database.
select is(
  (select count(*)::int from public.follows
    where follower_id = '11111111-1111-1111-1111-111111111111'
      and following_id = '22222222-2222-2222-2222-222222222222'),
  1,
  'public.follows row created with Alice as follower and Bob as following');

-- Relationship direction check: Bob is NOT following Alice.
select is(
  (select count(*)::int from public.follows
    where follower_id = '22222222-2222-2222-2222-222222222222'
      and following_id = '11111111-1111-1111-1111-111111111111'),
  0,
  'Bob is not following Alice (relationship is directed)');

-- Idempotent follow: Alice follows Bob again.
select is(
  (select public.set_follow('bob_flw', true)),
  jsonb_build_object(
    'target_username', 'bob_flw',
    'target_user_id', '22222222-2222-2222-2222-222222222222',
    'is_following', true,
    'changed', false
  ),
  'Alice following Bob again succeeds idempotently with changed=false');

-- Alice follows Carol (case-insensitivity check: 'CAROL_FLW').
select is(
  (select public.set_follow('CAROL_FLW', true)),
  jsonb_build_object(
    'target_username', 'carol_flw',
    'target_user_id', '33333333-3333-3333-3333-333333333333',
    'is_following', true,
    'changed', true
  ),
  'Target username resolution is case-insensitive and returns canonical username');

-- Follower and following counts truth check.
select is(
  (select count(*)::int from public.follows where follower_id = '11111111-1111-1111-1111-111111111111'),
  2,
  'Alice is following 2 users (Bob, Carol)');
select is(
  (select count(*)::int from public.follows where following_id = '22222222-2222-2222-2222-222222222222'),
  1,
  'Bob has 1 follower (Alice)');
select is(
  (select count(*)::int from public.follows where following_id = '33333333-3333-3333-3333-333333333333'),
  1,
  'Carol has 1 follower (Alice)');

-- Alice unfollows Bob.
select is(
  (select public.set_follow('bob_flw', false)),
  jsonb_build_object(
    'target_username', 'bob_flw',
    'target_user_id', '22222222-2222-2222-2222-222222222222',
    'is_following', false,
    'changed', true
  ),
  'Alice unfollowing Bob returns is_following=false and changed=true');

-- Verify Bob's follower count dropped to 0.
select is(
  (select count(*)::int from public.follows where following_id = '22222222-2222-2222-2222-222222222222'),
  0,
  'Bob now has 0 followers');

-- Idempotent unfollow: Alice unfollows Bob again.
select is(
  (select public.set_follow('bob_flw', false)),
  jsonb_build_object(
    'target_username', 'bob_flw',
    'target_user_id', '22222222-2222-2222-2222-222222222222',
    'is_following', false,
    'changed', false
  ),
  'Alice unfollowing Bob again returns changed=false without error');

-- Direct table access security check under authenticated role:
-- Alice cannot insert a follow relationship where follower_id != auth.uid().
select throws_ok(
  $$ insert into public.follows (follower_id, following_id)
     values ('22222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333333') $$,
  '42501',
  null,
  'Alice cannot insert a follow row on behalf of Bob (RLS check violation)');

-- Alice cannot delete a follow row owned by Bob.
-- Re-establish Bob following Carol as service_role for this test.
set local role postgres;
insert into public.follows (follower_id, following_id)
values ('22222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333333');

set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
delete from public.follows
where follower_id = '22222222-2222-2222-2222-222222222222'
  and following_id = '33333333-3333-3333-3333-333333333333';
select is(
  (select count(*)::int from public.follows
    where follower_id = '22222222-2222-2222-2222-222222222222'
      and following_id = '33333333-3333-3333-3333-333333333333'),
  1,
  'Alice cannot delete Bob''s follow row (RLS silently filters delete to follower_id = auth.uid())');

-- Cascading deletion: deleting auth user removes their follow rows.
set local role postgres;
delete from auth.users where id = '33333333-3333-3333-3333-333333333333';
select is(
  (select count(*)::int from public.follows
    where following_id = '33333333-3333-3333-3333-333333333333'
       or follower_id = '33333333-3333-3333-3333-333333333333'),
  0,
  'Deleting Carol cascades and removes all follow rows involving Carol');

select * from finish();
rollback;
