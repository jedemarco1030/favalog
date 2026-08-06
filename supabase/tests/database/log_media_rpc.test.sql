-- pgTAP: the atomic log/review write path (public.log_media) and the catalog
-- identity + grants it relies on.
--
-- Self-contained: creates its own auth users (…1111 / …2222) inside a
-- transaction that is rolled back, and resolves catalog titles by the stable
-- slugs installed by the forward-only catalog migration
-- (20260806160100_catalog_media_items.sql). Does NOT depend on seed.sql.
--
-- Run with the local stack: `npm run db:test` (requires Docker + Supabase CLI).

begin;
select plan(14);

-- ---------------------------------------------------------------------------
-- Fixtures: two auth users (profiles created by the trigger).
-- ---------------------------------------------------------------------------
insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data)
values
  ('00000000-0000-0000-0000-000000000000',
   '11111111-1111-1111-1111-111111111111',
   'authenticated', 'authenticated', 'alice@example.com',
   '{"username":"alice_rpc","display_name":"Alice"}'),
  ('00000000-0000-0000-0000-000000000000',
   '22222222-2222-2222-2222-222222222222',
   'authenticated', 'authenticated', 'bob@example.com',
   '{"username":"bob_rpc","display_name":"Bob"}');

-- The curated catalog bridge must resolve every loggable slug to one row.
select is(
  (select count(*)::int from public.media_items where source = 'favalog' and slug = 'afterglow'),
  1,
  'catalog identity bridge resolves a mock slug to exactly one media row'
);

-- ---------------------------------------------------------------------------
-- Execution privileges: authenticated may call, anon may not.
-- ---------------------------------------------------------------------------
select ok(
  has_function_privilege(
    'authenticated',
    'public.log_media(text, timestamp with time zone, numeric, boolean, text, text, boolean)',
    'execute'),
  'authenticated may execute log_media'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.log_media(text, timestamp with time zone, numeric, boolean, text, text, boolean)',
    'execute'),
  'anon may not execute log_media'
);

-- ---------------------------------------------------------------------------
-- Act as Alice for the write-path assertions.
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

-- Successful owner log (no rating, no review).
select lives_ok(
  $$ select public.log_media('afterglow') $$,
  'authenticated owner can log a title'
);

-- Exactly one diary entry, owned by the caller (ownership derives from auth.uid()).
select is(
  (select count(*)::int from public.diary_entries de
     join public.media_items mi on mi.id = de.media_id
    where de.user_id = '11111111-1111-1111-1111-111111111111'
      and mi.slug = 'afterglow'),
  1,
  'log creates exactly one diary entry owned by the authenticated caller'
);

-- Successful log WITH a rating and a linked review.
select lives_ok(
  $$ select public.log_media(
       'paper-lantern', now(), 4.5, false,
       'A tidy little chase', 'Rival cartographers, one map, zero chill.', false) $$,
  'authenticated owner can log a title with a rating and linked review'
);

-- The diary entry owns the rating.
select is(
  (select de.rating from public.diary_entries de
     join public.media_items mi on mi.id = de.media_id
    where de.user_id = '11111111-1111-1111-1111-111111111111'
      and mi.slug = 'paper-lantern'),
  4.5::numeric(2,1),
  'the diary entry stores the supplied rating'
);

-- The linked review exists and its rating is NULL (single source of truth).
select is(
  (select r.rating from public.reviews r
     join public.media_items mi on mi.id = r.media_id
    where r.user_id = '11111111-1111-1111-1111-111111111111'
      and mi.slug = 'paper-lantern'
      and r.diary_entry_id is not null),
  null,
  'a diary-linked review stores rating = NULL'
);
select is(
  (select r.body from public.reviews r
     join public.media_items mi on mi.id = r.media_id
    where r.user_id = '11111111-1111-1111-1111-111111111111'
      and mi.slug = 'paper-lantern'),
  'Rival cartographers, one map, zero chill.',
  'the linked review persists the supplied body'
);

-- Rewatch / reread support.
select lives_ok(
  $$ select public.log_media('low-country', now(), null, true) $$,
  'a rewatch/reread log is accepted'
);
select is(
  (select de.is_revisit from public.diary_entries de
     join public.media_items mi on mi.id = de.media_id
    where de.user_id = '11111111-1111-1111-1111-111111111111'
      and mi.slug = 'low-country'),
  true,
  'the revisit flag is persisted'
);

-- Invalid (non half-star) rating is rejected with a clean error.
select throws_ok(
  $$ select public.log_media('afterglow', now(), 4.3) $$,
  '22023',
  null,
  'a non half-star rating is rejected'
);

-- Unknown media identity is rejected.
select throws_ok(
  $$ select public.log_media('this-slug-does-not-exist') $$,
  'P0002',
  null,
  'an unknown media slug is rejected'
);

-- Unauthenticated caller (authenticated role but no auth.uid()) is rejected by
-- the in-function guard.
set local request.jwt.claims = '{"role":"authenticated"}';
select throws_ok(
  $$ select public.log_media('afterglow') $$,
  '28000',
  null,
  'a call without an authenticated identity is rejected'
);

select * from finish();
rollback;
