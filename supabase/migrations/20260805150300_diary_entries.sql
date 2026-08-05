-- Favalog backend foundation: diary entries.
--
-- A diary entry is a single chronological log event — a title a user watched
-- or read on a given day. Mirrors `DiaryEntry` in lib/types.ts. Media is
-- referenced by id, never embedded.
--
-- SOURCE OF TRUTH for ratings: the diary entry records the user's rating at
-- log time. Reviews may optionally reference a diary entry and resolve their
-- displayed rating from it (see the reviews migration). This keeps a single
-- authoritative rating per log event.
--
-- Intentionally NO unique (user_id, media_id): users rewatch and reread, so a
-- user may have many entries for the same title.

create table public.diary_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  media_id uuid not null references public.media_items (id) on delete cascade,
  -- The diary date — when the title was logged (not necessarily now()).
  logged_at timestamptz not null default now(),
  -- Rating in half-star increments, 0.5–5.0, when the user rated at log time.
  rating numeric(2, 1),
  -- True when this is a rewatch / reread rather than a first viewing/read.
  is_revisit boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Favalog's UI is half-star from 0.5 to 5. Whole 0 is not a valid rating
  -- (absence of a rating is represented by NULL).
  constraint diary_entries_rating_range check (
    rating is null
    or (rating >= 0.5 and rating <= 5.0 and (rating * 2) = floor(rating * 2))
  )
);

create index diary_entries_user_id_logged_at_idx
  on public.diary_entries (user_id, logged_at desc);
create index diary_entries_media_id_idx on public.diary_entries (media_id);

comment on table public.diary_entries is
  'Chronological per-user log of watched/read titles. Owner has full CRUD; publicly readable to support public profiles (see backend-architecture.md).';

create trigger diary_entries_set_updated_at
  before update on public.diary_entries
  for each row execute function public.set_updated_at();
