-- Favalog backend foundation: unified media catalog.
--
-- One table represents every trackable title (movie / TV / book), mirroring
-- the `MediaItem` discriminated union in lib/types.ts. Fields shared by every
-- kind are normal columns; the fields that vary substantially by kind live in
-- a typed `details` JSONB payload (director/cast, seasons/episodes, authors/…)
-- so we do not flatten every optional property into one giant table.

create table public.media_items (
  id uuid primary key default gen_random_uuid(),
  kind public.media_kind not null,
  -- Provenance of the record. 'favalog' marks curated/internal seed rows; real
  -- provider ingestion (e.g. tmdb, openlibrary) can be added later without a
  -- schema change. No provider is assumed to be permanently selected.
  source text not null default 'favalog',
  -- Provider-native identifier within `source`. For curated rows this is the
  -- internal slug; for provider rows it is the provider's id.
  external_id text not null,
  -- Stable, URL-safe identifier that /title/[slug] routes off. Distinct from
  -- the mutable display title, matching the domain contract.
  slug text not null,
  title text not null,
  subtitle text,
  synopsis text not null default '',
  -- Release / publication year.
  year integer not null,
  poster_url text,
  backdrop_url text,
  -- Aggregate community rating on a 0–5 scale, when known. Community ratings
  -- are otherwise derived; this column is a cached convenience.
  average_rating numeric(3, 2),
  genres text[] not null default '{}',
  -- Kind-specific metadata. Shape is validated in the domain mapping layer
  -- (lib/supabase/mappers.ts), keeping the DB pragmatic while the TypeScript
  -- model stays strict.
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint media_items_slug_format check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint media_items_title_length check (char_length(title) between 1 and 300),
  constraint media_items_year_range check (year between 1800 and 2200),
  constraint media_items_average_rating_range
    check (average_rating is null or (average_rating >= 0 and average_rating <= 5))
);

-- A title has one canonical identity per provider.
create unique index media_items_source_external_id_key
  on public.media_items (source, external_id);
-- Slugs are globally unique so /title/[slug] resolves to exactly one title.
create unique index media_items_slug_key on public.media_items (slug);
-- Common access patterns: filter by kind, and list newest titles.
create index media_items_kind_idx on public.media_items (kind);
create index media_items_year_idx on public.media_items (year desc);
-- Genre containment / tag queries.
create index media_items_genres_idx on public.media_items using gin (genres);

comment on table public.media_items is
  'Unified catalog of movies, TV, and books. Publicly readable; writes are restricted to trusted server-side processes (service role), never the browser client.';

create trigger media_items_set_updated_at
  before update on public.media_items
  for each row execute function public.set_updated_at();
