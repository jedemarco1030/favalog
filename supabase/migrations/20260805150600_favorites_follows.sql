-- Favalog backend foundation: favorites and follows.
--
-- Favorites mirror `Favorite` in lib/types.ts: a deliberate, ordered,
-- cross-media shelf. Follows are a minimal directed relationship between two
-- profiles. Neither table duplicates media or profile details.

create table public.favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  media_id uuid not null references public.media_items (id) on delete cascade,
  -- Deliberate display order of the favorites shelf; deterministic ordering key.
  position integer not null default 0,
  created_at timestamptz not null default now(),

  constraint favorites_position_non_negative check (position >= 0)
);

-- A user favorites a given title at most once.
create unique index favorites_user_id_media_id_key
  on public.favorites (user_id, media_id);
-- Deterministic ordering of a user's shelf.
create unique index favorites_user_id_position_key
  on public.favorites (user_id, position);

comment on table public.favorites is
  'A user''s ordered, cross-media favorites shelf. References media by id only. Owner write; publicly readable for public profiles.';

-- ---------------------------------------------------------------------------
-- Follows: a directed follower -> following relationship between profiles.
-- ---------------------------------------------------------------------------
create table public.follows (
  follower_id uuid not null references public.profiles (id) on delete cascade,
  following_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),

  -- Composite uniqueness: a relationship exists at most once.
  primary key (follower_id, following_id),
  -- A user cannot follow themselves.
  constraint follows_no_self_follow check (follower_id <> following_id)
);

-- Reverse lookups (who follows this profile).
create index follows_following_id_idx on public.follows (following_id);

comment on table public.follows is
  'Directed follow relationships between profiles. A user may create/delete only rows where follower_id = auth.uid(). Publicly readable for the social-profile model. No follow UI in this phase.';
