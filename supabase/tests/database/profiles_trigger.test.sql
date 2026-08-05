-- pgTAP: automatic profile provisioning via the handle_new_user trigger.
--
-- These tests exercise the auth/onboarding-critical behavior of the
-- `on_auth_user_created` trigger defined in
-- `supabase/migrations/20260805150100_profiles.sql`:
--   * a public.profiles row is created for every new auth.users row;
--   * the `username` / `display_name` metadata keys the app sends on sign-up
--     are honored (these MUST match what the trigger reads);
--   * a missing username falls back to the email local-part;
--   * case-insensitive collisions get a deterministic numeric suffix;
--   * an unusable handle falls back to a `user_<hex>` placeholder.
--
-- Run with the local stack: `npm run db:test` (requires Docker + Supabase CLI).

begin;
select plan(5);

-- Sign-up with explicit metadata (as our signUpAction sends it).
insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data)
values (
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-0000-0000-0000000000a1',
  'authenticated', 'authenticated',
  'alice@example.com',
  jsonb_build_object('username', 'alice_01', 'display_name', 'Alice A.')
);

select is(
  (select username::text from public.profiles
     where id = '00000000-0000-0000-0000-0000000000a1'),
  'alice_01',
  'trigger stores the username metadata key the app sends'
);

select is(
  (select display_name from public.profiles
     where id = '00000000-0000-0000-0000-0000000000a1'),
  'Alice A.',
  'trigger stores the display_name metadata key the app sends'
);

-- Sign-up WITHOUT metadata: username derives from the email local-part.
insert into auth.users (instance_id, id, aud, role, email)
values ('00000000-0000-0000-0000-000000000000',
        '00000000-0000-0000-0000-0000000000b1',
        'authenticated', 'authenticated', 'bob@example.com');

select is(
  (select username::text from public.profiles
     where id = '00000000-0000-0000-0000-0000000000b1'),
  'bob',
  'trigger derives a username from the email local-part when metadata is absent'
);

-- A second "bob" collides case-insensitively and gets a numeric suffix.
insert into auth.users (instance_id, id, aud, role, email)
values ('00000000-0000-0000-0000-000000000000',
        '00000000-0000-0000-0000-0000000000b2',
        'authenticated', 'authenticated', 'BOB@elsewhere.com');

select is(
  (select username::text from public.profiles
     where id = '00000000-0000-0000-0000-0000000000b2'),
  'bob_1',
  'trigger resolves a case-insensitive username collision with a suffix'
);

-- An unusable handle (too short after sanitizing) falls back to user_<hex>.
insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data)
values (
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-0000-0000-0000000000c1',
  'authenticated', 'authenticated',
  'c@example.com',
  jsonb_build_object('username', '!!')
);

select matches(
  (select username::text from public.profiles
     where id = '00000000-0000-0000-0000-0000000000c1'),
  '^user_',
  'trigger falls back to a user_ placeholder for an unusable handle'
);

select * from finish();
rollback;
