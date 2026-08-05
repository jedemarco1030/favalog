-- Favalog backend foundation: reviews.
--
-- Mirrors `Review` in lib/types.ts. A review is a longer-form write-up about a
-- title, optionally tied to a specific diary entry (the log event it is about).
--
-- RATING SOURCE OF TRUTH: to avoid representing the same rating inconsistently
-- across diary and review records, a review does NOT persist its own rating
-- when it references a diary entry — the display resolves the rating from the
-- linked diary_entries row. A standalone review (no diary_entry_id) may carry
-- its own `rating` so an opinion can exist without a formal log event. The
-- check constraint below enforces this rule at the database level.

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  media_id uuid not null references public.media_items (id) on delete cascade,
  -- Optional link to the log event this review is about. ON DELETE SET NULL:
  -- deleting the diary entry keeps the review but detaches it.
  diary_entry_id uuid references public.diary_entries (id) on delete set null,
  title text,
  body text not null,
  -- Only meaningful for standalone reviews; must be NULL when diary_entry_id is
  -- set (rating is then resolved from the diary entry). Half-star 0.5–5.0.
  rating numeric(2, 1),
  contains_spoilers boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint reviews_title_length check (title is null or char_length(title) <= 150),
  constraint reviews_body_length check (char_length(body) between 1 and 10000),
  constraint reviews_rating_range check (
    rating is null
    or (rating >= 0.5 and rating <= 5.0 and (rating * 2) = floor(rating * 2))
  ),
  -- A review linked to a diary entry must not duplicate a rating.
  constraint reviews_rating_source_of_truth check (
    diary_entry_id is null or rating is null
  )
);

create index reviews_media_id_created_at_idx
  on public.reviews (media_id, created_at desc);
create index reviews_user_id_created_at_idx
  on public.reviews (user_id, created_at desc);
create index reviews_diary_entry_id_idx on public.reviews (diary_entry_id);

comment on table public.reviews is
  'User reviews of titles. Rating source of truth is the linked diary entry when present; standalone reviews may carry their own rating. Public read; owner write.';

comment on column public.reviews.rating is
  'Only set for standalone reviews (diary_entry_id IS NULL). When a diary entry is linked, the displayed rating is resolved from it.';

create trigger reviews_set_updated_at
  before update on public.reviews
  for each row execute function public.set_updated_at();
