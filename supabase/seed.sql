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
-- Media catalog (small cross-media sample: movie, movie, tv, book, book)
-- ---------------------------------------------------------------------------
insert into public.media_items (
  id, kind, source, external_id, slug, title, subtitle, synopsis, year,
  poster_url, backdrop_url, average_rating, genres, details
)
values
  (
    '00000000-0000-0000-0000-0000000000b1', 'movie', 'favalog', 'dune-part-two',
    'dune-part-two', 'Dune: Part Two', null,
    'The second half of a desert epic. A young heir chooses which prophecy to inhabit and which one to burn.',
    2024, '/media/posters/duneparttwo.svg', '/media/backdrops/duneparttwo.svg',
    4.70, array['Science Fiction','Epic'],
    '{"runtimeMinutes":166,"director":"Marek Halloran","cast":["Nadia Reyes","Idris Kane","Soraya Bloom"]}'::jsonb
  ),
  (
    '00000000-0000-0000-0000-0000000000b2', 'movie', 'favalog', 'afterglow',
    'afterglow', 'Afterglow', null,
    'A composer returns to the coastal town where she grew up and confronts a summer that has quietly refused to end.',
    2023, '/media/posters/afterglow.svg', '/media/backdrops/afterglow.svg',
    4.30, array['Drama','Romance'],
    '{"runtimeMinutes":118,"director":"Noor Salim","cast":["Iris Vale","Teodoro Bassi","Hana Lundgren"]}'::jsonb
  ),
  (
    '00000000-0000-0000-0000-0000000000b3', 'tv', 'favalog', 'northlight',
    'northlight', 'Northlight', null,
    'A remote research station picks up a signal that seems to remember the people who hear it.',
    2022, '/media/posters/northlight.svg', null,
    4.10, array['Science Fiction','Mystery'],
    '{"seasons":2,"episodes":16,"creators":["Lena Voss"],"status":"ongoing"}'::jsonb
  ),
  (
    '00000000-0000-0000-0000-0000000000b4', 'book', 'favalog', 'the-north-room',
    'the-north-room', 'The North Room', null,
    'A translator inherits a house whose rooms rearrange themselves around the stories told inside them.',
    2021, '/media/posters/northroom.svg', null,
    4.40, array['Literary Fiction'],
    '{"authors":["Camille Roux"],"pageCount":328,"publisher":"Harbour & Vale"}'::jsonb
  ),
  (
    '00000000-0000-0000-0000-0000000000b5', 'book', 'favalog', 'the-bright-index',
    'the-bright-index', 'The Bright Index', 'A Field Guide',
    'A cataloguer of vanishing things assembles an index that begins to predict what disappears next.',
    2020, '/media/posters/brightindex.svg', null,
    4.20, array['Speculative','Essays'],
    '{"authors":["Devon Halle"],"pageCount":274}'::jsonb
  );

-- ---------------------------------------------------------------------------
-- Diary entries (chronological log; supports a rewatch)
-- ---------------------------------------------------------------------------
insert into public.diary_entries (id, user_id, media_id, logged_at, rating, is_revisit)
values
  (
    '00000000-0000-0000-0000-0000000000d1',
    '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b1',
    '2026-01-15T20:00:00Z', 4.5, false
  ),
  (
    '00000000-0000-0000-0000-0000000000d2',
    '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b4',
    '2026-02-02T09:30:00Z', 5.0, false
  ),
  -- A rewatch of the same movie proves the "no unique per user/media" rule.
  (
    '00000000-0000-0000-0000-0000000000d3',
    '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b1',
    '2026-03-10T21:15:00Z', 5.0, true
  ),
  (
    '00000000-0000-0000-0000-0000000000d4',
    '00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000b3',
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
    '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b1',
    '00000000-0000-0000-0000-0000000000d1',
    'A desert that keeps its promises',
    'Every frame earns its scale. The rating for this one lives on the diary entry, not here.',
    null, false
  ),
  (
    '00000000-0000-0000-0000-0000000000e2',
    '00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000b4',
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
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000b1', 0, 'Top of the year.'),
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000b4', 1, null),
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000b3', 2, 'Slow burn, worth it.'),
  ('00000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-0000000000b5', 0, null);

-- ---------------------------------------------------------------------------
-- Favorites (ordered cross-media shelf)
-- ---------------------------------------------------------------------------
insert into public.favorites (user_id, media_id, position)
values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b1', 0),
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b4', 1),
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b3', 2),
  ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000b5', 0);

-- ---------------------------------------------------------------------------
-- Follows (directed relationships between profiles)
-- ---------------------------------------------------------------------------
insert into public.follows (follower_id, following_id)
values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a2'),
  ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000a1'),
  ('00000000-0000-0000-0000-0000000000a3', '00000000-0000-0000-0000-0000000000a1');
