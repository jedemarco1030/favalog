-- pgTAP: persistent review + list likes.
--
-- Covers: authenticated-only mutation grants and anon+authenticated read grants;
-- SECURITY INVOKER mutations / SECURITY DEFINER reads with pinned search_path;
-- like / unlike / repeated idempotency; composite-PK uniqueness; anonymous
-- rejection and cross-user impersonation via direct table writes; self-likes;
-- review existence authorization; the full public / followers / private list
-- visibility matrix; revocation then re-access; correct counts; cascade cleanup
-- on target and account deletion; and direct-table read restrictions (no liker
-- disclosure).
--
-- Self-contained: creates its own auth users and its own review + lists as the
-- setup (superuser) role so inaccessible-list ids can be referenced by bare id
-- later. Resolves catalog titles by the stable slugs installed by the catalog
-- migration (20260806160100). Does NOT depend on seed.sql.
--
-- Run with the local stack: `npm run db:test` (requires Docker + Supabase CLI).

begin;
select no_plan();

-- ---------------------------------------------------------------------------
-- Fixtures: two auth users (profiles created by the trigger).
--   Alice = …1111 (author/owner), Bob = …2222 (liker).
-- ---------------------------------------------------------------------------
insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data)
values
  ('00000000-0000-0000-0000-000000000000',
   '11111111-1111-1111-1111-111111111111',
   'authenticated', 'authenticated', 'alice_like@example.com',
   '{"username":"alice_like","display_name":"Alice"}'),
  ('00000000-0000-0000-0000-000000000000',
   '22222222-2222-2222-2222-222222222222',
   'authenticated', 'authenticated', 'bob_like@example.com',
   '{"username":"bob_like","display_name":"Bob"}');

-- Fixture content created as the setup role (RLS bypassed) so we can capture
-- ids for ALL lists — including ones Bob must never see — and assert that a
-- bare id discloses nothing.
create temporary table ids (name text primary key, id uuid) on commit drop;

insert into ids (name, id)
values ('review', gen_random_uuid()),
       ('list_public', gen_random_uuid()),
       ('list_followers', gen_random_uuid()),
       ('list_private', gen_random_uuid());

insert into public.reviews (id, user_id, media_id, title, body)
select (select id from ids where name = 'review'),
       '11111111-1111-1111-1111-111111111111',
       mi.id,
       'A luminous debut',
       'Alice''s standalone review body for afterglow.'
from public.media_items mi
where mi.slug = 'afterglow';

insert into public.lists (id, user_id, slug, title, description, is_ranked, visibility)
values
  ((select id from ids where name = 'list_public'),
   '11111111-1111-1111-1111-111111111111',
   'alice-public-picks', 'Alice Public Picks', null, false, 'public'),
  ((select id from ids where name = 'list_followers'),
   '11111111-1111-1111-1111-111111111111',
   'alice-inner-circle', 'Alice Inner Circle', null, false, 'followers'),
  ((select id from ids where name = 'list_private'),
   '11111111-1111-1111-1111-111111111111',
   'alice-secret', 'Alice Secret', null, false, 'private');

-- ---------------------------------------------------------------------------
-- Execution privileges.
-- ---------------------------------------------------------------------------
select ok(has_function_privilege('authenticated', 'public.set_review_like(uuid, boolean)', 'execute'),
  'authenticated may execute set_review_like');
select ok(not has_function_privilege('anon', 'public.set_review_like(uuid, boolean)', 'execute'),
  'anon may not execute set_review_like');
select ok(not has_function_privilege('public', 'public.set_review_like(uuid, boolean)', 'execute'),
  'public may not execute set_review_like');
select ok(has_function_privilege('authenticated', 'public.set_list_like(uuid, boolean)', 'execute'),
  'authenticated may execute set_list_like');
select ok(not has_function_privilege('anon', 'public.set_list_like(uuid, boolean)', 'execute'),
  'anon may not execute set_list_like');

-- Batched reads are readable by anon (signed-out counts) and authenticated.
select ok(has_function_privilege('anon', 'public.get_review_like_states(uuid[])', 'execute'),
  'anon may execute get_review_like_states');
select ok(has_function_privilege('authenticated', 'public.get_review_like_states(uuid[])', 'execute'),
  'authenticated may execute get_review_like_states');
select ok(has_function_privilege('anon', 'public.get_list_like_states(uuid[])', 'execute'),
  'anon may execute get_list_like_states');
select ok(has_function_privilege('authenticated', 'public.get_list_like_states(uuid[])', 'execute'),
  'authenticated may execute get_list_like_states');

-- ---------------------------------------------------------------------------
-- Security configuration.
-- ---------------------------------------------------------------------------
select is((select prosecdef from pg_proc where oid = 'public.set_review_like(uuid, boolean)'::regprocedure),
  false, 'set_review_like is SECURITY INVOKER');
select is((select prosecdef from pg_proc where oid = 'public.set_list_like(uuid, boolean)'::regprocedure),
  false, 'set_list_like is SECURITY INVOKER');
select is((select prosecdef from pg_proc where oid = 'public.get_review_like_states(uuid[])'::regprocedure),
  true, 'get_review_like_states is SECURITY DEFINER');
select is((select prosecdef from pg_proc where oid = 'public.get_list_like_states(uuid[])'::regprocedure),
  true, 'get_list_like_states is SECURITY DEFINER');
select ok((select proconfig from pg_proc where oid = 'public.set_review_like(uuid, boolean)'::regprocedure) @> array['search_path=""'],
  'set_review_like pins search_path to empty');
select ok((select proconfig from pg_proc where oid = 'public.set_list_like(uuid, boolean)'::regprocedure) @> array['search_path=""'],
  'set_list_like pins search_path to empty');
select ok((select proconfig from pg_proc where oid = 'public.get_review_like_states(uuid[])'::regprocedure) @> array['search_path=""'],
  'get_review_like_states pins search_path to empty');
select ok((select proconfig from pg_proc where oid = 'public.get_list_like_states(uuid[])'::regprocedure) @> array['search_path=""'],
  'get_list_like_states pins search_path to empty');
select is((select pronargs from pg_proc where oid = 'public.set_review_like(uuid, boolean)'::regprocedure)::int,
  2, 'set_review_like takes exactly two args (no user_id parameter)');
select is((select pronargs from pg_proc where oid = 'public.set_list_like(uuid, boolean)'::regprocedure)::int,
  2, 'set_list_like takes exactly two args (no user_id parameter)');

-- ---------------------------------------------------------------------------
-- Anonymous mutation is rejected by the grant.
-- ---------------------------------------------------------------------------
set local role anon;
set local request.jwt.claims = '{}';
select throws_ok(
  format($$ select public.set_review_like(%L, true) $$, (select id from ids where name = 'review')),
  '42501', null, 'anonymous review like is rejected by the grant');
select throws_ok(
  format($$ select public.set_list_like(%L, true) $$, (select id from ids where name = 'list_public')),
  '42501', null, 'anonymous list like is rejected by the grant');

-- A signed-out visitor still reads real counts (currently zero) for public
-- content, and never sees a viewer bit.
select is(
  (select like_count from public.get_review_like_states(array[(select id from ids where name = 'review')])),
  0::bigint, 'anon reads a real (zero) review like count');
select is(
  (select viewer_has_liked from public.get_list_like_states(array[(select id from ids where name = 'list_public')])),
  false, 'anon list viewer bit is false');
-- Anon cannot even see a followers/private list count row.
select is(
  (select count(*)::int from public.get_list_like_states(array[
     (select id from ids where name = 'list_followers'),
     (select id from ids where name = 'list_private')])),
  0, 'anon gets no rows for followers/private lists (no disclosure)');

-- ---------------------------------------------------------------------------
-- Act as Bob (liker). Bob does NOT follow Alice yet.
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';

-- Bob likes Alice's (public) review.
select lives_ok(
  format($$ select public.set_review_like(%L, true) $$, (select id from ids where name = 'review')),
  'Bob can like an accessible review');
select is(
  (select like_count from public.get_review_like_states(array[(select id from ids where name = 'review')])),
  1::bigint, 'the review like count is 1 after Bob likes it');
select is(
  (select viewer_has_liked from public.get_review_like_states(array[(select id from ids where name = 'review')])),
  true, 'Bob sees his own review viewer bit as true');

-- Repeated like is idempotent (no duplicate row, count stays 1).
select lives_ok(
  format($$ select public.set_review_like(%L, true) $$, (select id from ids where name = 'review')),
  'a repeated review like does not error');
select is(
  (select count(*)::int from public.review_likes where review_id = (select id from ids where name = 'review')),
  1, 'a repeated review like does not duplicate the row');

-- Bob likes Alice's PUBLIC list without following.
select lives_ok(
  format($$ select public.set_list_like(%L, true) $$, (select id from ids where name = 'list_public')),
  'Bob can like a public list without following');
select is(
  (select like_count from public.get_list_like_states(array[(select id from ids where name = 'list_public')])),
  1::bigint, 'the public list like count is 1');

-- Bob CANNOT like the FOLLOWERS list before following: a bare id fails
-- uniformly (same error as a nonexistent id) and discloses nothing.
select throws_ok(
  format($$ select public.set_list_like(%L, true) $$, (select id from ids where name = 'list_followers')),
  'P0002', null, 'Bob cannot like a followers-only list before following (no disclosure)');
select is(
  (select count(*)::int from public.get_list_like_states(array[(select id from ids where name = 'list_followers')])),
  0, 'the followers list is absent from Bob''s reads before following');

-- Bob CANNOT like the PRIVATE list ever.
select throws_ok(
  format($$ select public.set_list_like(%L, true) $$, (select id from ids where name = 'list_private')),
  'P0002', null, 'Bob cannot like a private list (no disclosure)');

-- A nonexistent review / list id fails the same way (uniform, safe).
select throws_ok(
  $$ select public.set_review_like('00000000-0000-0000-0000-0000000000aa', true) $$,
  'P0002', null, 'liking a nonexistent review fails safely');
select throws_ok(
  $$ select public.set_list_like('00000000-0000-0000-0000-0000000000bb', true) $$,
  'P0002', null, 'liking a nonexistent list fails safely');

-- ---------------------------------------------------------------------------
-- Bob follows Alice → the followers list becomes accessible and likeable.
-- ---------------------------------------------------------------------------
select lives_ok($$ select public.set_follow('alice_like', true) $$, 'Bob follows Alice');
select lives_ok(
  format($$ select public.set_list_like(%L, true) $$, (select id from ids where name = 'list_followers')),
  'Bob can like the followers list once following');
select is(
  (select like_count from public.get_list_like_states(array[(select id from ids where name = 'list_followers')])),
  1::bigint, 'the followers list like count is 1 while following');
select is(
  (select viewer_has_liked from public.get_list_like_states(array[(select id from ids where name = 'list_followers')])),
  true, 'Bob sees his followers-list viewer bit as true');

-- ---------------------------------------------------------------------------
-- Revocation: Bob unfollows. The like PERSISTS but the list, its count, and
-- the viewer bit disappear from Bob's reads, and Bob cannot mutate it.
-- ---------------------------------------------------------------------------
select lives_ok($$ select public.set_follow('alice_like', false) $$, 'Bob unfollows Alice');
select is(
  (select count(*)::int from public.get_list_like_states(array[(select id from ids where name = 'list_followers')])),
  0, 'after unfollow the followers list disappears from Bob''s reads');
select is(
  (select count(*)::int from public.list_likes
     where list_id = (select id from ids where name = 'list_followers')
       and user_id = '22222222-2222-2222-2222-222222222222'),
  1, 'the persisted like row still exists after revocation');
select throws_ok(
  format($$ select public.set_list_like(%L, false) $$, (select id from ids where name = 'list_followers')),
  'P0002', null, 'Bob cannot unlike the followers list while it is inaccessible');

-- Re-access: Bob follows again and sees the PERSISTED liked state.
select lives_ok($$ select public.set_follow('alice_like', true) $$, 'Bob follows Alice again');
select is(
  (select viewer_has_liked from public.get_list_like_states(array[(select id from ids where name = 'list_followers')])),
  true, 're-following reveals the persisted liked state');

-- ---------------------------------------------------------------------------
-- Unlike returns the count correctly.
-- ---------------------------------------------------------------------------
select lives_ok(
  format($$ select public.set_list_like(%L, false) $$, (select id from ids where name = 'list_public')),
  'Bob can unlike the public list');
select is(
  (select like_count from public.get_list_like_states(array[(select id from ids where name = 'list_public')])),
  0::bigint, 'the public list like count returns to 0 after unlike');
select is(
  (select viewer_has_liked from public.get_list_like_states(array[(select id from ids where name = 'list_public')])),
  false, 'Bob''s public-list viewer bit is false after unlike');
-- Idempotent unlike of an absent like is a no-op success.
select lives_ok(
  format($$ select public.set_list_like(%L, false) $$, (select id from ids where name = 'list_public')),
  'unliking an absent like does not error');

-- ---------------------------------------------------------------------------
-- Self-like: Alice may like her own accessible content (per the contract).
-- ---------------------------------------------------------------------------
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
select lives_ok(
  format($$ select public.set_review_like(%L, true) $$, (select id from ids where name = 'review')),
  'Alice can like her own review');
select lives_ok(
  format($$ select public.set_list_like(%L, true) $$, (select id from ids where name = 'list_private')),
  'Alice can like her own private list');
select is(
  (select like_count from public.get_review_like_states(array[(select id from ids where name = 'review')])),
  2::bigint, 'the review now has 2 likes (Alice + Bob)');

-- ---------------------------------------------------------------------------
-- Direct-table restrictions: a user cannot read another user's like rows, and
-- cannot forge a like owned by someone else (RLS is an independent boundary).
-- ---------------------------------------------------------------------------
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
-- Bob sees only his OWN review_likes rows, never Alice's.
select is(
  (select count(*)::int from public.review_likes),
  1, 'Bob can read only his own review like rows (not Alice''s)');
select throws_ok(
  $$ insert into public.review_likes (user_id, review_id)
     values ('11111111-1111-1111-1111-111111111111',
             (select id from public.reviews limit 1)) $$,
  '42501', null, 'Bob cannot forge a review like owned by Alice (RLS)');
select throws_ok(
  format($$ insert into public.list_likes (user_id, list_id)
            values ('11111111-1111-1111-1111-111111111111', %L) $$,
         (select id from ids where name = 'list_public')),
  '42501', null, 'Bob cannot forge a list like owned by Alice (RLS)');

-- In-function guard: authenticated role with no auth.uid() is rejected.
set local request.jwt.claims = '{"role":"authenticated"}';
select throws_ok(
  format($$ select public.set_review_like(%L, true) $$, (select id from ids where name = 'review')),
  '28000', null, 'set_review_like without an authenticated identity is rejected');

-- ---------------------------------------------------------------------------
-- Cascade cleanup on target deletion and account deletion (as setup role).
-- ---------------------------------------------------------------------------
reset role;
reset request.jwt.claims;

-- Deleting the review removes its like rows.
delete from public.reviews where id = (select id from ids where name = 'review');
select is(
  (select count(*)::int from public.review_likes where review_id = (select id from ids where name = 'review')),
  0, 'deleting a review cascades away its likes');

-- Deleting Bob's account removes his remaining like rows.
delete from auth.users where id = '22222222-2222-2222-2222-222222222222';
select is(
  (select count(*)::int from public.list_likes where user_id = '22222222-2222-2222-2222-222222222222'),
  0, 'deleting an account cascades away that user''s likes');

select * from finish();
rollback;
