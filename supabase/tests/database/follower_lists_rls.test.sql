-- pgTAP: Row Level Security for follower-only lists and list items.
--
-- Tests the complete visibility matrix across:
--   - Public lists: Owner (Allow), Follower (Allow), Non-follower (Allow), Anon (Allow)
--   - Followers lists: Owner (Allow), Follower (Allow), Non-follower (Deny), Anon (Deny)
--   - Private lists: Owner (Allow), Follower (Deny), Non-follower (Deny), Anon (Deny)
--
-- Also tests:
--   - Directionality: Owner following Viewer does NOT grant access. Viewer must follow Owner.
--   - Follow grants access; Unfollow immediately revokes access.
--   - List items inherit exact parent list visibility.
--   - Owner write boundaries remain strictly owner-only.
--
-- Run with: `npm run db:test`

begin;
select plan(27);

-- ---------------------------------------------------------------------------
-- Fixtures: Alice (Owner), Bob (Viewer), Charlie (Unrelated)
-- ---------------------------------------------------------------------------
insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data)
values
  ('00000000-0000-0000-0000-000000000000',
   'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   'authenticated', 'authenticated', 'alice_lst@example.com',
   '{"username":"alice_lst","display_name":"Alice"}'),
  ('00000000-0000-0000-0000-000000000000',
   'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
   'authenticated', 'authenticated', 'bob_lst@example.com',
   '{"username":"bob_lst","display_name":"Bob"}'),
  ('00000000-0000-0000-0000-000000000000',
   'cccccccc-cccc-cccc-cccc-cccccccccccc',
   'authenticated', 'authenticated', 'charlie_lst@example.com',
   '{"username":"charlie_lst","display_name":"Charlie"}');

-- Create Alice's lists: 1 public, 1 followers, 1 private
-- and add items to each list.
set local role authenticated;
set local request.jwt.claims = '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}';

select lives_ok(
  $$ select public.create_list('Alice Public List', 'Public desc', false, 'public', 'afterglow') $$,
  'Alice can create a public list with an item');

select lives_ok(
  $$ select public.create_list('Alice Followers List', 'Followers desc', false, 'followers', 'northlight') $$,
  'Alice can create a followers list with an item');

select lives_ok(
  $$ select public.create_list('Alice Private List', 'Private desc', false, 'private', 'the-small-hours') $$,
  'Alice can create a private list with an item');

-- ---------------------------------------------------------------------------
-- 1. Owner visibility (Alice sees all 3 lists and all 3 items)
-- ---------------------------------------------------------------------------
select is(
  (select count(*)::int from public.lists where user_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  3,
  'Owner (Alice) sees all 3 of her owned lists');
select is(
  (select count(*)::int from public.list_items li join public.lists l on l.id = li.list_id where l.user_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  3,
  'Owner (Alice) sees all 3 items across her lists');

-- ---------------------------------------------------------------------------
-- 2. Anonymous visibility (sees only Public list and Public list items)
-- ---------------------------------------------------------------------------
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';

select is(
  (select count(*)::int from public.lists where user_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  1,
  'Anonymous viewer sees only 1 list from Alice (the public one)');
select is(
  (select visibility::text from public.lists where user_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  'public',
  'The single list visible to anonymous is public');
select is(
  (select count(*)::int from public.list_items li join public.lists l on l.id = li.list_id where l.user_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  1,
  'Anonymous viewer sees only items in the public list');

-- ---------------------------------------------------------------------------
-- 3. Authenticated non-follower visibility (Bob before following Alice)
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb","role":"authenticated"}';

select is(
  (select count(*)::int from public.lists where user_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  1,
  'Authenticated non-follower (Bob) sees only 1 list (public)');
select is(
  (select visibility::text from public.lists where user_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  'public',
  'Non-follower only sees public list');
select is(
  (select count(*)::int from public.list_items li join public.lists l on l.id = li.list_id where l.user_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  1,
  'Non-follower only sees items in public list');

-- ---------------------------------------------------------------------------
-- 4. Reverse follow does NOT grant access (Alice follows Bob; Bob does NOT follow Alice)
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}';
select public.set_follow('bob_lst', true);

-- Act as Bob again: Bob still does not follow Alice
set local role authenticated;
set local request.jwt.claims = '{"sub":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb","role":"authenticated"}';
select is(
  (select count(*)::int from public.lists where user_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  1,
  'Alice following Bob does NOT grant Bob access to Alice''s followers list');

-- ---------------------------------------------------------------------------
-- 5. Follow grants access (Bob follows Alice)
-- ---------------------------------------------------------------------------
select public.set_follow('alice_lst', true);

select is(
  (select count(*)::int from public.lists where user_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  2,
  'Current follower (Bob) sees 2 lists (public and followers)');
select is(
  (select array_agg(visibility::text order by visibility::text) from public.lists where user_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  array['followers', 'public'],
  'Follower sees followers and public lists, but NOT private');
select is(
  (select count(*)::int from public.list_items li join public.lists l on l.id = li.list_id where l.user_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  2,
  'Follower sees items in both public and followers lists');

-- Unrelated non-follower Charlie still only sees 1 list (public)
set local role authenticated;
set local request.jwt.claims = '{"sub":"cccccccc-cccc-cccc-cccc-cccccccccccc","role":"authenticated"}';
select is(
  (select count(*)::int from public.lists where user_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  1,
  'Other non-follower (Charlie) still sees only 1 list');

-- ---------------------------------------------------------------------------
-- 6. Unfollow revokes access immediately
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb","role":"authenticated"}';
select public.set_follow('alice_lst', false);

select is(
  (select count(*)::int from public.lists where user_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  1,
  'After unfollowing, Bob immediately loses access to followers list');
select is(
  (select count(*)::int from public.list_items li join public.lists l on l.id = li.list_id where l.user_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  1,
  'After unfollowing, Bob immediately loses access to followers list items');

-- ---------------------------------------------------------------------------
-- 7. Update list visibility to/from followers
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}';

-- Alice changes her public list to followers
select lives_ok(
  $$ select public.update_list(
       (select id from public.lists where user_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' and visibility = 'public'),
       'Alice Formerly Public List',
       'Updated desc',
       false,
       'followers'
     ) $$,
  'Alice can update list visibility to followers');

-- Now anonymous sees 0 lists
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';
select is(
  (select count(*)::int from public.lists where user_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  0,
  'Anonymous viewer sees 0 lists when former public list is changed to followers');

-- Non-follower Bob sees 0 lists
set local role authenticated;
set local request.jwt.claims = '{"sub":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb","role":"authenticated"}';
select is(
  (select count(*)::int from public.lists where user_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  0,
  'Non-follower Bob sees 0 lists when no public list exists');

-- Bob follows Alice again -> now sees 2 lists (both followers)
select public.set_follow('alice_lst', true);
select is(
  (select count(*)::int from public.lists where user_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  2,
  'Follower Bob sees both followers lists');

-- Alice updates one list to private -> Bob now sees 1 list (the remaining followers list)
set local role authenticated;
set local request.jwt.claims = '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}';
select lives_ok(
  $$ select public.update_list(
       (select id from public.lists where user_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' and title = 'Alice Formerly Public List'),
       'Alice Now Private List',
       'Updated desc',
       false,
       'private'
     ) $$,
  'Alice can update list visibility to private');

set local role authenticated;
set local request.jwt.claims = '{"sub":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb","role":"authenticated"}';
select is(
  (select count(*)::int from public.lists where user_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  1,
  'Follower Bob cannot see private list');

-- ---------------------------------------------------------------------------
-- 8. Owner write boundaries (Follower cannot write to Alice's list)
-- ---------------------------------------------------------------------------
-- Direct UPDATE by Bob matches 0 rows under RLS.
update public.lists set title = 'Hacked' where user_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

select is(
  (select count(*)::int from public.lists where user_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' and title = 'Hacked'),
  0,
  'Bob cannot update Alice''s list (0 rows updated via RLS)');

select throws_ok(
  $$ select public.update_list(
       (select id from public.lists where user_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' limit 1),
       'Hacked', 'desc', false, 'public'
     ) $$,
  'P0002',
  null,
  'Bob cannot call update_list on Alice''s list (fails with P0002)');

select throws_ok(
  $$ insert into public.list_items (list_id, media_id, position)
     values (
       (select id from public.lists where user_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' limit 1),
       (select id from public.media_items limit 1),
       99
     ) $$,
  '42501',
  null,
  'Bob cannot insert items into Alice''s list (RLS check violation)');

select * from finish();
rollback;
