-- Favalog backend foundation: lists and ordered list items.
--
-- Mirrors `List` in lib/types.ts. A list is a user-authored, cross-media
-- collection. Its titles are referenced by list_items (never embedded) and
-- carry a deterministic order via `position`.

create table public.lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  -- Stable, URL-safe identifier that /list/[slug] routes off. Unique per owner
  -- (a user's slugs never collide; two different users may share a slug).
  slug text not null,
  title text not null,
  description text,
  -- When true, `position` order is a deliberate ranking shown to users.
  is_ranked boolean not null default false,
  visibility public.list_visibility not null default 'public',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint lists_slug_format check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint lists_title_length check (char_length(title) between 1 and 150),
  constraint lists_description_length
    check (description is null or char_length(description) <= 2000)
);

-- Slugs are unique within an owner, matching the domain contract.
create unique index lists_user_id_slug_key on public.lists (user_id, slug);
create index lists_user_id_idx on public.lists (user_id);
create index lists_visibility_idx on public.lists (visibility);

comment on table public.lists is
  'User-authored cross-media collections. Slugs unique per owner. Owner write; public lists are publicly readable (followers/private visibility is represented but not fully enforced until follows exist).';

create trigger lists_set_updated_at
  before update on public.lists
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Ordered items within a list.
-- ---------------------------------------------------------------------------
create table public.list_items (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references public.lists (id) on delete cascade,
  media_id uuid not null references public.media_items (id) on delete cascade,
  -- Zero-based ordering within the list; deterministic ordering key.
  position integer not null,
  -- Optional sparse curator note for this title within this list.
  note text,
  created_at timestamptz not null default now(),

  constraint list_items_position_non_negative check (position >= 0),
  constraint list_items_note_length check (note is null or char_length(note) <= 1000)
);

-- A media item may appear at most once per list.
create unique index list_items_list_id_media_id_key
  on public.list_items (list_id, media_id);
-- Ordering within a list is unique and deterministic.
create unique index list_items_list_id_position_key
  on public.list_items (list_id, position);

comment on table public.list_items is
  'Ordered membership of media in a list. A user may modify list_items only when they own the parent list (enforced via RLS EXISTS check).';
