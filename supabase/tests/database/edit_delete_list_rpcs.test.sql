-- pgTAP: the whole-list EDIT and DELETE write paths (public.update_list,
-- public.delete_list), their security configuration, ownership enforcement,
-- validation/normalization, slug immutability, order preservation, item
-- cascade, and continued private-list non-disclosure.
--
-- Self-contained: creates its own auth users (…1111 Alice / …2222 Bob) inside a
-- transaction that is rolled back, and resolves catalog titles by the stable
-- slugs installed by the catalog migration (20260806160100). Does NOT depend on
-- seed.sql.
--
-- Run with the local stack: `npm run db:test` (requires Docker + Supabase CLI).

begin;
select plan(39);

-- ---------------------------------------------------------------------------
-- Fixtures: two auth users (profiles created by the trigger).
-- ---------------------------------------------------------------------------
insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data)
values
  ('00000000-0000-0000-0000-000000000000',
   '11111111-1111-1111-1111-111111111111',
   'authenticated', 'authenticated', 'alice_editlist@example.com',
   '{"username":"alice_edit","display_name":"Alice"}'),
  ('00000000-0000-0000-0000-000000000000',
   '22222222-2222-2222-2222-222222222222',
   'authenticated', 'authenticated', 'bob_editlist@example.com',
   '{"username":"bob_edit","display_name":"Bob"}');

-- ---------------------------------------------------------------------------
-- Execution privileges: authenticated may call, anon may not.
-- ---------------------------------------------------------------------------
select ok(
  has_function_privilege('authenticated',
    'public.update_list(uuid, text, text, boolean, text)', 'execute'),
  'authenticated may execute update_list');
select ok(
  not has_function_privilege('anon',
    'public.update_list(uuid, text, text, boolean, text)', 'execute'),
  'anon may not execute update_list');
select ok(
  not has_function_privilege('public',
    'public.update_list(uuid, text, text, boolean, text)', 'execute'),
  'public may not execute update_list');
select ok(
  has_function_privilege('authenticated',
    'public.delete_list(uuid)', 'execute'),
  'authenticated may execute delete_list');
select ok(
  not has_function_privilege('anon',
    'public.delete_list(uuid)', 'execute'),
  'anon may not execute delete_list');
select ok(
  not has_function_privilege('public',
    'public.delete_list(uuid)', 'execute'),
  'public may not execute delete_list');

-- ---------------------------------------------------------------------------
-- Security configuration: SECURITY INVOKER and pinned empty search_path.
-- ---------------------------------------------------------------------------
select is(
  (select prosecdef from pg_proc
    where oid = 'public.update_list(uuid, text, text, boolean, text)'::regprocedure),
  false,
  'update_list is SECURITY INVOKER (not SECURITY DEFINER)');
select is(
  (select prosecdef from pg_proc
    where oid = 'public.delete_list(uuid)'::regprocedure),
  false,
  'delete_list is SECURITY INVOKER (not SECURITY DEFINER)');
select ok(
  (select proconfig from pg_proc
    where oid = 'public.update_list(uuid, text, text, boolean, text)'::regprocedure)
    @> array['search_path=""'],
  'update_list pins search_path to empty');
select ok(
  (select proconfig from pg_proc
    where oid = 'public.delete_list(uuid)'::regprocedure)
    @> array['search_path=""'],
  'delete_list pins search_path to empty');

-- ---------------------------------------------------------------------------
-- Act as Alice: seed a ranked, private list with three ordered titles.
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

select public.create_list('My Films', 'A short canon.', true, 'private');
select public.add_list_item(
  (select id from public.lists where slug = 'alice-edit-my-films'), 'afterglow');
select public.add_list_item(
  (select id from public.lists where slug = 'alice-edit-my-films'), 'paper-lantern');
select public.add_list_item(
  (select id from public.lists where slug = 'alice-edit-my-films'), 'low-country');

-- Age updated_at so a later edit provably bumps it (now() is fixed per txn).
reset role;
alter table public.lists disable trigger lists_set_updated_at;
update public.lists set updated_at = timestamptz '2000-01-01 00:00:00+00'
  where slug = 'alice-edit-my-films';
alter table public.lists enable trigger lists_set_updated_at;
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

-- Successful owner metadata update: title, description, unrank, make public.
select lives_ok(
  $$ select public.update_list(
       (select id from public.lists where slug = 'alice-edit-my-films'),
       '  Best Films  ', '  Now public.  ', false, 'public') $$,
  'owner can update their own list metadata');

-- Title/description are normalized (trimmed); is_ranked + visibility applied.
select is(
  (select title from public.lists where slug = 'alice-edit-my-films'),
  'Best Films',
  'update_list trims and stores the new title');
select is(
  (select description from public.lists where slug = 'alice-edit-my-films'),
  'Now public.',
  'update_list trims and stores the new description');
select is(
  (select is_ranked from public.lists where slug = 'alice-edit-my-films'),
  false,
  'update_list applies the ranked/unranked change');
select is(
  (select visibility::text from public.lists where slug = 'alice-edit-my-films'),
  'public',
  'update_list applies the public/private change');

-- The slug is immutable across a title change.
select is(
  (select count(*)::int from public.lists where slug = 'alice-edit-my-films'),
  1,
  'the slug is unchanged after a title edit (immutable)');

-- updated_at was refreshed by the edit.
select ok(
  (select updated_at from public.lists where slug = 'alice-edit-my-films')
    > timestamptz '2000-01-01 00:00:00+00',
  'update_list refreshes updated_at');

-- Order and positions are preserved across the ranked -> unranked change.
select is(
  (select array_agg(mi.slug order by li.position)
     from public.list_items li
     join public.lists l on l.id = li.list_id
     join public.media_items mi on mi.id = li.media_id
    where l.slug = 'alice-edit-my-films'),
  array['afterglow', 'paper-lantern', 'low-country'],
  'update_list preserves the existing item order');
select is(
  (select array_agg(li.position order by li.position)
     from public.list_items li
     join public.lists l on l.id = li.list_id
    where l.slug = 'alice-edit-my-films'),
  array[0, 1, 2],
  'update_list preserves the existing item positions');

-- Description clearing: a blank description normalizes to NULL.
select lives_ok(
  $$ select public.update_list(
       (select id from public.lists where slug = 'alice-edit-my-films'),
       'Best Films', '   ', false, 'public') $$,
  'owner can clear the description with blank input');
select is(
  (select description from public.lists where slug = 'alice-edit-my-films'),
  null,
  'a blank description is normalized to NULL');

-- Toggle back to private (public/private change both directions).
select lives_ok(
  $$ select public.update_list(
       (select id from public.lists where slug = 'alice-edit-my-films'),
       'Best Films', null, false, 'private') $$,
  'owner can switch the list back to private');
select is(
  (select visibility::text from public.lists where slug = 'alice-edit-my-films'),
  'private',
  'the visibility change to private is applied');

-- Validation: empty title and unsupported visibility are rejected.
select throws_ok(
  $$ select public.update_list(
       (select id from public.lists where slug = 'alice-edit-my-films'),
       '   ', null, false, 'private') $$,
  '22023', null,
  'updating with an empty title is rejected');
select throws_ok(
  $$ select public.update_list(
       (select id from public.lists where slug = 'alice-edit-my-films'),
       'Best Films', null, false, 'followers') $$,
  '22023', null,
  'updating to a followers/other visibility is rejected');

-- Unknown list id fails safely.
select throws_ok(
  $$ select public.update_list(
       '00000000-0000-0000-0000-0000000000aa'::uuid,
       'X', null, false, 'public') $$,
  'P0002', null,
  'updating an unknown list id fails safely');

-- ---------------------------------------------------------------------------
-- Act as Bob: cross-owner update/delete must not affect Alice's list.
-- ---------------------------------------------------------------------------
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';

-- A private list is hidden from a non-owner (continued non-disclosure).
select is(
  (select count(*)::int from public.lists where slug = 'alice-edit-my-films'),
  0,
  'a private list remains hidden from a non-owner');

-- Cross-owner update attempt fails (list not owned by caller).
select throws_ok(
  $$ select public.update_list(
       (select id from public.lists l
         where l.user_id = '11111111-1111-1111-1111-111111111111'),
       'Hijacked', null, false, 'public') $$,
  'P0002', null,
  'a cross-owner update attempt fails safely');

-- Cross-owner delete attempt fails.
select throws_ok(
  $$ select public.delete_list(
       (select id from public.lists l
         where l.user_id = '11111111-1111-1111-1111-111111111111')) $$,
  'P0002', null,
  'a cross-owner delete attempt fails safely');

-- Prove Alice's list and items are untouched by Bob's attempts.
reset role;
select is(
  (select count(*)::int from public.lists where slug = 'alice-edit-my-films'),
  1,
  'the target list still exists after cross-owner attempts');
select is(
  (select count(*)::int from public.list_items li
     join public.lists l on l.id = li.list_id
    where l.slug = 'alice-edit-my-films'),
  3,
  'the target list items are untouched after cross-owner attempts');
select is(
  (select title from public.lists where slug = 'alice-edit-my-films'),
  'Best Films',
  'the target list title is untouched after a cross-owner update attempt');

-- ---------------------------------------------------------------------------
-- Act as Alice again: successful owner deletion removes the list + its items.
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

select lives_ok(
  $$ select public.delete_list(
       (select id from public.lists where slug = 'alice-edit-my-films')) $$,
  'owner can delete their own list');
select is(
  (select count(*)::int from public.lists where slug = 'alice-edit-my-films'),
  0,
  'the list is gone after deletion');

-- Global orphan check bypassing RLS: no list_items reference a missing list.
reset role;
select is(
  (select count(*)::int from public.list_items li
     where not exists (
       select 1 from public.lists l where l.id = li.list_id)),
  0,
  'no orphaned list_items remain after deletion (FK cascade)');
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

-- Deleting an unknown list id fails safely.
select throws_ok(
  $$ select public.delete_list('00000000-0000-0000-0000-0000000000aa'::uuid) $$,
  'P0002', null,
  'deleting an unknown list id fails safely');

-- ---------------------------------------------------------------------------
-- Anonymous callers are rejected by the grant.
-- ---------------------------------------------------------------------------
set local role anon;
set local request.jwt.claims = '{}';
select throws_ok(
  $$ select public.update_list('00000000-0000-0000-0000-0000000000aa'::uuid, 'X', null, false, 'public') $$,
  '42501', null,
  'anonymous update is rejected by the grant');
select throws_ok(
  $$ select public.delete_list('00000000-0000-0000-0000-0000000000aa'::uuid) $$,
  '42501', null,
  'anonymous delete is rejected by the grant');

-- ---------------------------------------------------------------------------
-- In-function guard: authenticated role with no auth.uid() is rejected.
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"role":"authenticated"}';
select throws_ok(
  $$ select public.update_list('00000000-0000-0000-0000-0000000000aa'::uuid, 'X', null, false, 'public') $$,
  '28000', null,
  'update_list without an authenticated identity is rejected');

select * from finish();
rollback;
