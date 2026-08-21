-- pgTAP: the persistent favorites write path (public.set_favorite), its
-- append/compaction position behavior, idempotency, cross-media support,
-- RLS read visibility + owner-write enforcement, and authenticated-only grants.
--
-- Self-contained: creates its own auth users (…1111 Alice / …2222 Bob) inside a
-- transaction that is rolled back, and resolves catalog titles by the stable
-- slugs installed by the catalog migration (20260806160100). Does NOT depend on
-- seed.sql.
--
-- Run with the local stack: `npm run db:test` (requires Docker + Supabase CLI).

begin;
select plan(33);

-- ---------------------------------------------------------------------------
-- Fixtures: two auth users (profiles created by the trigger).
-- ---------------------------------------------------------------------------
insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data)
values
  ('00000000-0000-0000-0000-000000000000',
   '11111111-1111-1111-1111-111111111111',
   'authenticated', 'authenticated', 'alice_fav@example.com',
   '{"username":"alice_fav","display_name":"Alice"}'),
  ('00000000-0000-0000-0000-000000000000',
   '22222222-2222-2222-2222-222222222222',
   'authenticated', 'authenticated', 'bob_fav@example.com',
   '{"username":"bob_fav","display_name":"Bob"}');

-- ---------------------------------------------------------------------------
-- Execution privileges: authenticated may call; anon / public may not.
-- ---------------------------------------------------------------------------
select ok(
  has_function_privilege('authenticated',
    'public.set_favorite(text, boolean)', 'execute'),
  'authenticated may execute set_favorite');
select ok(
  not has_function_privilege('anon',
    'public.set_favorite(text, boolean)', 'execute'),
  'anon may not execute set_favorite');
select ok(
  not has_function_privilege('public',
    'public.set_favorite(text, boolean)', 'execute'),
  'public may not execute set_favorite');

-- ---------------------------------------------------------------------------
-- Security configuration: SECURITY INVOKER, pinned empty search_path, and a
-- signature that offers NO way to choose a user or a position (only a trusted
-- slug + a desired boolean).
-- ---------------------------------------------------------------------------
select is(
  (select prosecdef from pg_proc
    where oid = 'public.set_favorite(text, boolean)'::regprocedure),
  false,
  'set_favorite is SECURITY INVOKER (not SECURITY DEFINER)');
select ok(
  (select proconfig from pg_proc
    where oid = 'public.set_favorite(text, boolean)'::regprocedure)
    @> array['search_path=""'],
  'set_favorite pins search_path to empty');
select is(
  (select pronargs from pg_proc
    where oid = 'public.set_favorite(text, boolean)'::regprocedure)::int,
  2,
  'set_favorite takes exactly two args (no user_id / position parameter)');

-- ---------------------------------------------------------------------------
-- Act as Alice for the write-path assertions.
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

-- Favorite a known movie.
select lives_ok(
  $$ select public.set_favorite('afterglow', true) $$,
  'authenticated user can favorite a known movie');
select is(
  (select position from public.favorites f
     join public.media_items mi on mi.id = f.media_id
    where f.user_id = '11111111-1111-1111-1111-111111111111'
      and mi.slug = 'afterglow'),
  0,
  'the first favorite is at position 0');
select is(
  (select count(*)::int from public.favorites f
     join public.media_items mi on mi.id = f.media_id
    where f.user_id = '11111111-1111-1111-1111-111111111111'
      and mi.slug = 'afterglow'),
  1,
  'the favorite exists exactly once');

-- Favorite a TV title and a book (cross-media).
select lives_ok(
  $$ select public.set_favorite('northlight', true) $$,
  'authenticated user can favorite a TV title');
select lives_ok(
  $$ select public.set_favorite('the-small-hours', true) $$,
  'authenticated user can favorite a book');
select is(
  (select array_agg(f.position order by f.position)
     from public.favorites f
    where f.user_id = '11111111-1111-1111-1111-111111111111'),
  array[0, 1, 2],
  'subsequent favorites append contiguously (0,1,2)');

-- Re-favoriting an existing title is an idempotent success (no duplicate).
select lives_ok(
  $$ select public.set_favorite('afterglow', true) $$,
  'favoriting an already-favorited title does not error');
select is(
  (select count(*)::int from public.favorites
    where user_id = '11111111-1111-1111-1111-111111111111'),
  3,
  'a repeated favorite request does not duplicate the row');
select is(
  (select position from public.favorites f
     join public.media_items mi on mi.id = f.media_id
    where f.user_id = '11111111-1111-1111-1111-111111111111'
      and mi.slug = 'afterglow'),
  0,
  'a repeated favorite leaves the existing position unchanged');
select is(
  (select (count(*) = count(distinct media_id))
     from public.favorites
    where user_id = '11111111-1111-1111-1111-111111111111'),
  true,
  'a user has at most one favorite row per title');

-- Remove the MIDDLE favorite (northlight); positions compact.
select lives_ok(
  $$ select public.set_favorite('northlight', false) $$,
  'owner can remove a favorite');
select is(
  (select array_agg(f.position order by f.position)
     from public.favorites f
    where f.user_id = '11111111-1111-1111-1111-111111111111'),
  array[0, 1],
  'a middle removal compacts remaining positions to a contiguous range');
select is(
  (select array_agg(mi.slug order by f.position)
     from public.favorites f
     join public.media_items mi on mi.id = f.media_id
    where f.user_id = '11111111-1111-1111-1111-111111111111'),
  array['afterglow', 'the-small-hours'],
  'the surviving favorites keep their relative order after compaction');

-- Removing a title that is not a favorite is an idempotent success.
select lives_ok(
  $$ select public.set_favorite('low-country', false) $$,
  'removing an absent favorite does not error');
select is(
  (select count(*)::int from public.favorites
    where user_id = '11111111-1111-1111-1111-111111111111'),
  2,
  'an idempotent absent-removal changes nothing');

-- Re-favoriting a removed title appends it at the end.
select lives_ok(
  $$ select public.set_favorite('northlight', true) $$,
  're-favoriting a removed title appends it');
select is(
  (select position from public.favorites f
     join public.media_items mi on mi.id = f.media_id
    where f.user_id = '11111111-1111-1111-1111-111111111111'
      and mi.slug = 'northlight'),
  2,
  're-favoriting appends at the end (position 2)');
select is(
  (select array_agg(f.position order by f.position)
     from public.favorites f
    where f.user_id = '11111111-1111-1111-1111-111111111111'),
  array[0, 1, 2],
  'positions remain unique and contiguous after re-favoriting');
select ok(
  (select coalesce(min(position), 0) >= 0 from public.favorites
    where user_id = '11111111-1111-1111-1111-111111111111'),
  'positions remain non-negative throughout');

-- Unknown media slug is rejected safely.
select throws_ok(
  $$ select public.set_favorite('this-slug-does-not-exist', true) $$,
  'P0002', null,
  'favoriting an unknown media slug fails safely');

-- ---------------------------------------------------------------------------
-- Act as Bob: independent shelf; cannot write a row owned by Alice.
-- ---------------------------------------------------------------------------
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';

select lives_ok(
  $$ select public.set_favorite('afterglow', true) $$,
  'a second user can favorite the same title independently');
select is(
  (select position from public.favorites f
     join public.media_items mi on mi.id = f.media_id
    where f.user_id = '22222222-2222-2222-2222-222222222222'
      and mi.slug = 'afterglow'),
  0,
  'the second user gets their own position-0 favorite');
select is(
  (select count(*)::int from public.favorites f
     join public.media_items mi on mi.id = f.media_id
    where f.user_id = '11111111-1111-1111-1111-111111111111'
      and mi.slug = 'afterglow'),
  1,
  'the first user''s favorite is unaffected by the second user');

-- Owner-write RLS is an independent boundary: a direct cross-user insert (not
-- via the RPC) is rejected by the WITH CHECK policy.
select throws_ok(
  $$ insert into public.favorites (user_id, media_id, position)
     values ('11111111-1111-1111-1111-111111111111',
             (select id from public.media_items where slug = 'low-country'),
             5) $$,
  '42501', null,
  'a user cannot write a favorite row owned by someone else (RLS)');

-- ---------------------------------------------------------------------------
-- Act as anon: favorites are publicly readable, but writes are rejected.
-- ---------------------------------------------------------------------------
set local role anon;
set local request.jwt.claims = '{}';

select is(
  (select count(*)::int from public.favorites
    where user_id = '11111111-1111-1111-1111-111111111111'),
  3,
  'a public visitor can read a profile owner''s favorites');
select throws_ok(
  $$ select public.set_favorite('afterglow', true) $$,
  '42501', null,
  'anonymous favoriting is rejected by the grant');

-- ---------------------------------------------------------------------------
-- In-function guard: authenticated role with no auth.uid() is rejected.
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"role":"authenticated"}';
select throws_ok(
  $$ select public.set_favorite('afterglow', true) $$,
  '28000', null,
  'set_favorite without an authenticated identity is rejected');

select * from finish();
rollback;
