-- Favalog local seed data.
--
-- Loaded by `supabase db reset` after migrations. This is a SMALL, deterministic
-- dataset that exercises every relationship — it is NOT a migration of the full
-- mock catalog in lib/data. All IDs are fixed so tests can reference them.
--
-- AUTH ASSUMPTIONS (local development only):
--   * The three users below are LOCAL TEST USERS inserted directly into
--     auth.users using the documented Supabase local-dev pattern (bcrypt via
--     the pgcrypto extension). They exist only in a local database created by
--     `supabase db reset`; no real credentials are ever committed.
--   * All three share the password `password123` and use @example.com emails.
--   * Inserting into auth.users fires public.handle_new_user(), which creates a
--     public.profiles row from raw_user_meta_data. We then UPDATE those profiles
--     to add bio/location/avatar that the trigger does not populate.
--   * This direct auth.users insert is intended for LOCAL ONLY. Remote/staging
--     environments should provision users through the Auth API instead.

-- ---------------------------------------------------------------------------
-- Local test auth users (-> profiles via trigger)
-- ---------------------------------------------------------------------------
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data,
  confirmation_token, email_change, email_change_token_new, recovery_token
)
values
  (
    '00000000-0000-0000-0000-000000000000',
    '00000000-0000-0000-0000-0000000000a1',
    'authenticated', 'authenticated', 'jamie@example.com',
    extensions.crypt('password123', extensions.gen_salt('bf')),
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}',
    '{"username":"jamie","display_name":"Jamie DeMarco"}',
    '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '00000000-0000-0000-0000-0000000000a2',
    'authenticated', 'authenticated', 'mira@example.com',
    extensions.crypt('password123', extensions.gen_salt('bf')),
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}',
    '{"username":"mira","display_name":"Mira Bhatt"}',
    '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '00000000-0000-0000-0000-0000000000a3',
    'authenticated', 'authenticated', 'jules@example.com',
    extensions.crypt('password123', extensions.gen_salt('bf')),
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}',
    '{"username":"jules","display_name":"Jules Marchetti"}',
    '', '', '', ''
  );

-- Enrich the trigger-created profiles with fields the trigger does not set.
update public.profiles set
  bio = 'Software engineer, hockey fan, movie watcher, book reader.',
  location = 'Boston, MA',
  avatar_url = '/media/avatars/jamie.svg'
where id = '00000000-0000-0000-0000-0000000000a1';

update public.profiles set
  bio = 'Film school dropout. Print-first. Coffee-second.',
  location = 'Lisbon, Portugal',
  avatar_url = '/media/avatars/mira.svg'
where id = '00000000-0000-0000-0000-0000000000a2';

update public.profiles set
  bio = 'Notes from the couch. Sci-fi, noir, and long trilogies.',
  location = 'Turin, Italy',
  avatar_url = '/media/avatars/jules.svg'
where id = '00000000-0000-0000-0000-0000000000a3';

-- ---------------------------------------------------------------------------
-- Media catalog
-- ---------------------------------------------------------------------------
-- Catalog identity is owned by the forward-only migration
-- `20260806160100_catalog_media_items.sql`, NOT by this seed. The demo rows
-- below therefore REFERENCE those curated catalog rows by their stable,
-- deterministic UUID — md5('favalog:' || <immutable mock id>)::uuid — instead of
-- redefining catalog rows here (which would collide on the unique slug). This
-- keeps a single source of truth for catalog identity and lets the same demo
-- data resolve against the real curated catalog in any environment.

-- ---------------------------------------------------------------------------
-- Diary entries (chronological log; supports a rewatch)
-- ---------------------------------------------------------------------------
insert into public.diary_entries (id, user_id, media_id, logged_at, rating, is_revisit)
values
  (
    '00000000-0000-0000-0000-0000000000d1',
    '00000000-0000-0000-0000-0000000000a1', md5('favalog:m_duneparttwo')::uuid,
    '2026-01-15T20:00:00Z', 4.5, false
  ),
  (
    '00000000-0000-0000-0000-0000000000d2',
    '00000000-0000-0000-0000-0000000000a1', md5('favalog:b_northroom')::uuid,
    '2026-02-02T09:30:00Z', 5.0, false
  ),
  -- A rewatch of the same movie proves the "no unique per user/media" rule.
  (
    '00000000-0000-0000-0000-0000000000d3',
    '00000000-0000-0000-0000-0000000000a1', md5('favalog:m_duneparttwo')::uuid,
    '2026-03-10T21:15:00Z', 5.0, true
  ),
  (
    '00000000-0000-0000-0000-0000000000d4',
    '00000000-0000-0000-0000-0000000000a2', md5('favalog:t_northlight')::uuid,
    '2026-02-20T22:00:00Z', 4.0, false
  );

-- ---------------------------------------------------------------------------
-- Reviews (one tied to a diary entry -> rating resolved from it; one standalone)
-- ---------------------------------------------------------------------------
insert into public.reviews (
  id, user_id, media_id, diary_entry_id, title, body, rating, contains_spoilers
)
values
  (
    '00000000-0000-0000-0000-0000000000e1',
    '00000000-0000-0000-0000-0000000000a1', md5('favalog:m_duneparttwo')::uuid,
    '00000000-0000-0000-0000-0000000000d1',
    'A desert that keeps its promises',
    'Every frame earns its scale. The rating for this one lives on the diary entry, not here.',
    null, false
  ),
  (
    '00000000-0000-0000-0000-0000000000e2',
    '00000000-0000-0000-0000-0000000000a2', md5('favalog:b_northroom')::uuid,
    null,
    'Quietly unforgettable',
    'A standalone review with its own rating because it is not tied to a specific log event.',
    4.5, false
  );

-- ---------------------------------------------------------------------------
-- Lists and ordered items (a ranked, public, cross-media list)
-- ---------------------------------------------------------------------------
insert into public.lists (id, user_id, slug, title, description, is_ranked, visibility)
values
  (
    '00000000-0000-0000-0000-0000000000f1',
    '00000000-0000-0000-0000-0000000000a1', 'my-2026-so-far',
    'My 2026 So Far', 'The best of what I have watched and read this year.',
    true, 'public'
  ),
  (
    '00000000-0000-0000-0000-0000000000f2',
    '00000000-0000-0000-0000-0000000000a2', 'private-drafts',
    'Private Drafts', 'A private list that only its owner can read.',
    false, 'private'
  );

insert into public.list_items (list_id, media_id, position, note)
values
  ('00000000-0000-0000-0000-0000000000f1', md5('favalog:m_duneparttwo')::uuid, 0, 'Top of the year.'),
  ('00000000-0000-0000-0000-0000000000f1', md5('favalog:b_northroom')::uuid, 1, null),
  ('00000000-0000-0000-0000-0000000000f1', md5('favalog:t_northlight')::uuid, 2, 'Slow burn, worth it.'),
  ('00000000-0000-0000-0000-0000000000f2', md5('favalog:b_bright_index')::uuid, 0, null);

-- ---------------------------------------------------------------------------
-- Favorites (ordered cross-media shelf)
-- ---------------------------------------------------------------------------
insert into public.favorites (user_id, media_id, position)
values
  ('00000000-0000-0000-0000-0000000000a1', md5('favalog:m_duneparttwo')::uuid, 0),
  ('00000000-0000-0000-0000-0000000000a1', md5('favalog:b_northroom')::uuid, 1),
  ('00000000-0000-0000-0000-0000000000a1', md5('favalog:t_northlight')::uuid, 2),
  ('00000000-0000-0000-0000-0000000000a2', md5('favalog:b_bright_index')::uuid, 0);

-- ---------------------------------------------------------------------------
-- Follows (directed relationships between profiles)
-- ---------------------------------------------------------------------------
insert into public.follows (follower_id, following_id)
values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a2'),
  ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000a1'),
  ('00000000-0000-0000-0000-0000000000a3', '00000000-0000-0000-0000-0000000000a1');
