-- pgTAP: Phase 4C.1 game schema — the 'game' media kind, the RAWG provider
-- identity constraint, and the owner-only public.game_statuses table (RLS,
-- grants, game-only trigger, enum validation).
--
-- Self-contained: fixtures use literal UUIDs (no temp tables, so role switches
-- never hit "permission denied for table") inside a rolled-back transaction.
--
-- Run with the local stack: `npm run db:test` (requires Docker + Supabase CLI).

begin;
select plan(13);

insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data)
values
  ('00000000-0000-0000-0000-000000000000',
   '11111111-1111-1111-1111-111111111111',
   'authenticated', 'authenticated', 'alice_game@example.com',
   '{"username":"alice_game","display_name":"Alice"}'),
  ('00000000-0000-0000-0000-000000000000',
   '22222222-2222-2222-2222-222222222222',
   'authenticated', 'authenticated', 'bob_game@example.com',
   '{"username":"bob_game","display_name":"Bob"}');

insert into public.media_items (id, kind, source, external_id, slug, title, year, details)
values
  ('30000000-0000-0000-0000-000000000001', 'game', 'favalog', 'probe-game',
   'probe-game', 'Probe Game', 2017,
   '{"platforms":["PC"],"developers":["Probe Studio"],"publishers":["Probe Pub"]}'),
  ('30000000-0000-0000-0000-000000000002', 'movie', 'favalog', 'probe-film-4c',
   'probe-film-4c', 'Probe Film', 2017, '{}');

-- ---------------------------------------------------------------------------
-- Schema shape
-- ---------------------------------------------------------------------------
select ok(
  'game' = any(enum_range(null::public.media_kind)::text[]),
  'media_kind includes game'
);

select ok(
  (select pg_get_constraintdef(oid) like '%rawg%'
     from pg_constraint where conname = 'media_external_ids_provider_check'),
  'media_external_ids provider check admits rawg'
);

select ok(
  (select pg_get_constraintdef(oid) like '%tmdb%'
            and pg_get_constraintdef(oid) like '%openlibrary%'
     from pg_constraint where conname = 'media_external_ids_provider_check'),
  'existing tmdb/openlibrary providers remain allowed'
);

select has_table('public', 'game_statuses', 'game_statuses table exists');

select ok(
  (select relrowsecurity from pg_class where oid = 'public.game_statuses'::regclass),
  'RLS is enabled on game_statuses'
);

select ok(
  not has_table_privilege('anon', 'public.game_statuses', 'select'),
  'anon has no privileges on game_statuses'
);

-- ---------------------------------------------------------------------------
-- Owner writes (Alice)
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

select lives_ok(
  $$insert into public.game_statuses (user_id, media_id, status)
    values ('11111111-1111-1111-1111-111111111111',
            '30000000-0000-0000-0000-000000000001', 'playing')$$,
  'owner can set a status on a game'
);

select throws_ok(
  $$insert into public.game_statuses (user_id, media_id, status)
    values ('11111111-1111-1111-1111-111111111111',
            '30000000-0000-0000-0000-000000000002', 'completed')$$,
  '22023', 'status applies only to games',
  'status cannot attach to a non-game title'
);

select throws_ok(
  $$insert into public.game_statuses (user_id, media_id, status)
    values ('22222222-2222-2222-2222-222222222222',
            '30000000-0000-0000-0000-000000000001', 'backlog')$$,
  '42501', null,
  'cannot write a status for another user'
);

select throws_ok(
  $$insert into public.game_statuses (user_id, media_id, status)
    values ('11111111-1111-1111-1111-111111111111',
            '30000000-0000-0000-0000-000000000001', 'beaten')$$,
  '22P02', null,
  'unknown status values are rejected by the enum'
);

update public.game_statuses set status = 'completed'
 where user_id = '11111111-1111-1111-1111-111111111111'
   and media_id = '30000000-0000-0000-0000-000000000001';

select is(
  (select status::text from public.game_statuses
    where media_id = '30000000-0000-0000-0000-000000000001'),
  'completed',
  'owner can update their status'
);

-- ---------------------------------------------------------------------------
-- Owner-only visibility (Bob)
-- ---------------------------------------------------------------------------
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';

select is(
  (select count(*)::int from public.game_statuses),
  0,
  'another user cannot read the owner''s status'
);

delete from public.game_statuses
 where media_id = '30000000-0000-0000-0000-000000000001';

reset role;

select is(
  (select count(*)::int from public.game_statuses
    where user_id = '11111111-1111-1111-1111-111111111111'),
  1,
  'another user cannot delete the owner''s status'
);

select * from finish();
rollback;
