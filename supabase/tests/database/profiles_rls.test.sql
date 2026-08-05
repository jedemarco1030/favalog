-- pgTAP: profile-write RLS for the onboarding flow.
--
-- The broad schema/RLS suite (`schema_and_rls.test.sql`) covers catalog reads,
-- diary/list ownership, and case-insensitive username uniqueness. This file
-- focuses on the specific write the onboarding Server Action performs: a user
-- updating their OWN public.profiles row, and the denial of updating someone
-- else's — the guarantee `completeOnboardingAction` relies on.
--
-- Run with the local stack: `npm run db:test` (requires Docker + Supabase CLI).

begin;
select plan(3);

insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data)
values
  ('00000000-0000-0000-0000-000000000000',
   '11111111-1111-1111-1111-111111111111',
   'authenticated', 'authenticated', 'alice@example.com',
   '{"username":"alice","display_name":"Alice"}'),
  ('00000000-0000-0000-0000-000000000000',
   '22222222-2222-2222-2222-222222222222',
   'authenticated', 'authenticated', 'bravo@example.com',
   '{"username":"bravo","display_name":"Bravo"}');

-- Act as Alice.
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

-- Owner write: Alice completes her own profile.
select lives_ok(
  $$ update public.profiles
       set display_name = 'Alice A.', bio = 'Watching everything.'
       where id = '11111111-1111-1111-1111-111111111111' $$,
  'a user can update their own profile'
);

-- Cross-user write denial: the UPDATE matches 0 rows under RLS, so Bravo's
-- profile is untouched.
update public.profiles set bio = 'hacked'
  where id = '22222222-2222-2222-2222-222222222222';
select is(
  (select bio from public.profiles
     where id = '22222222-2222-2222-2222-222222222222'),
  null,
  'a user cannot modify another user''s profile'
);

-- Public read: profiles remain readable by anonymous visitors.
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';
select is(
  (select count(*)::int from public.profiles
     where id in ('11111111-1111-1111-1111-111111111111',
                  '22222222-2222-2222-2222-222222222222')),
  2,
  'profiles are publicly readable by anon'
);

select * from finish();
rollback;
