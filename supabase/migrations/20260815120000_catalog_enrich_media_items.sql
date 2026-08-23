-- Favalog AI Discovery v1 (1/3): enrich the curated catalog + add a lexical FTS
-- index to public.media_items.
--
-- WHY: the catalog identity bridge (20260806160100) gave every curated title a
-- stable row carrying only kind/slug/title/year/genres. Hybrid retrieval — and
-- the canonical embedding document — need the *descriptive* catalog content
-- (synopsis, subtitle, credits) that until now lived only in the mock data
-- layer (lib/data/media.ts). This migration backfills that content into the
-- authoritative rows so the database is the single source of truth the
-- embedding pipeline and keyword search read from. Ids and slugs are untouched
-- (immutable identity); only presentation/detail columns are populated.
--
-- Forward-only + idempotent: matches on the stable slug and overwrites the
-- descriptive columns to their curated values, so re-running is safe. No user
-- data is involved.
--
-- Kind-specific fields go in `details` (mirrors lib/supabase/mappers.ts):
--   movie -> runtimeMinutes, director, cast
--   tv    -> seasons, episodes, creators, status
--   book  -> authors, pageCount, publisher

-- --- Movies -----------------------------------------------------------------
update public.media_items as mi set
  synopsis = v.synopsis,
  poster_url = v.poster_url,
  backdrop_url = v.backdrop_url,
  average_rating = v.average_rating,
  details = v.details,
  updated_at = now()
from (values
  ('afterglow',
    'A composer returns to the coastal town where she grew up and confronts a summer that has quietly refused to end.',
    '/media/posters/afterglow.svg', '/media/backdrops/afterglow.svg', 4.3::numeric,
    jsonb_build_object('runtimeMinutes', 118, 'director', 'Noor Salim',
      'cast', jsonb_build_array('Iris Vale', 'Teodoro Bassi', 'Hana Lundgren'))),
  ('paper-lantern',
    'Two rival cartographers race across a fictional Mediterranean to redraw a border that no one asked them to redraw.',
    '/media/posters/paperlantern.svg', null, 3.9::numeric,
    jsonb_build_object('runtimeMinutes', 104, 'director', 'Priya Deshmukh',
      'cast', jsonb_build_array('Wren Ashby', 'Kai Nomura'))),
  ('low-country',
    'A retired detective is pulled into a case that has been solved four separate times, each time incorrectly.',
    '/media/posters/lowcountry.svg', null, 4.1::numeric,
    jsonb_build_object('runtimeMinutes', 132, 'director', 'Emil Trakas',
      'cast', jsonb_build_array('Odette Rowe', 'Marcus Bell'))),
  ('dune-part-two',
    'The second half of a desert epic. A young heir chooses which prophecy to inhabit and which one to burn.',
    '/media/posters/duneparttwo.svg', '/media/backdrops/duneparttwo.svg', 4.7::numeric,
    jsonb_build_object('runtimeMinutes', 166, 'director', 'Marek Halloran',
      'cast', jsonb_build_array('Nadia Reyes', 'Idris Kane', 'Soraya Bloom'))),
  ('quiet-signal',
    'An acoustic engineer helping a submarine crew begins hearing a voice on a channel that shouldn''t have one.',
    '/media/posters/quietsignal.svg', null, 4.0::numeric,
    jsonb_build_object('runtimeMinutes', 121, 'director', 'Iona Petraki',
      'cast', jsonb_build_array('Lena Voss', 'Rhys Amare'))),
  ('the-cartographer',
    'A woman who draws maps for governments that no longer exist takes on a private commission she cannot verify.',
    '/media/posters/thecartographer.svg', null, 4.2::numeric,
    jsonb_build_object('runtimeMinutes', 109, 'director', 'Adaeze Umeh',
      'cast', jsonb_build_array('Thea Marlowe', 'Colm Bergin'))),
  ('night-ferry',
    'A single overnight crossing between two coastal cities, told through the six passengers who miss the same person.',
    '/media/posters/nightferry.svg', null, 4.5::numeric,
    jsonb_build_object('runtimeMinutes', 112, 'director', 'Livia Marchetti',
      'cast', jsonb_build_array('Rowan Kade', 'Mira Osei'))),
  ('arc-lighthouse',
    'A retired astronomer inherits a coastal lighthouse and slowly notices that the beam is answering something offshore.',
    '/media/posters/arclighthouse.svg', null, 4.0::numeric,
    jsonb_build_object('runtimeMinutes', 116, 'director', 'Ines Cortez',
      'cast', jsonb_build_array('Bram Solberg', 'Anya Duras'))),
  ('blue-hour-run',
    'A courier with a hairline crack in a rare vinyl acetate has one dawn to deliver it across a shuttered city.',
    '/media/posters/bluehourrun.svg', null, 3.7::numeric,
    jsonb_build_object('runtimeMinutes', 98, 'director', 'Kenji Aoki',
      'cast', jsonb_build_array('Tomas Riel', 'Sena Ovadia'))),
  ('slow-mountain',
    'Three cousins hike the family peak one last time before the ridge is sold off, and quietly renegotiate everything unsaid.',
    '/media/posters/slowmountain.svg', null, 4.4::numeric,
    jsonb_build_object('runtimeMinutes', 124, 'director', 'Rafael Bento',
      'cast', jsonb_build_array('Isabela Cruz', 'Diogo Serra', 'Vera Almeida')))
) as v(slug, synopsis, poster_url, backdrop_url, average_rating, details)
where mi.slug = v.slug;

-- --- TV ---------------------------------------------------------------------
update public.media_items as mi set
  synopsis = v.synopsis,
  poster_url = v.poster_url,
  backdrop_url = v.backdrop_url,
  average_rating = v.average_rating,
  details = v.details,
  updated_at = now()
from (values
  ('northlight',
    'In a town where the sun never fully sets, a young marine biologist begins receiving letters from someone who claims to be her.',
    '/media/posters/northlight.svg', '/media/backdrops/northlight.svg', 4.6::numeric,
    jsonb_build_object('seasons', 2, 'episodes', 16,
      'creators', jsonb_build_array('Sana Ito'), 'status', 'ongoing')),
  ('the-gilded-room',
    'Four strangers inherit an unusable hotel on the outskirts of a city that has slowly forgotten it exists.',
    '/media/posters/gildedroom.svg', null, 4.0::numeric,
    jsonb_build_object('seasons', 3, 'episodes', 24,
      'creators', jsonb_build_array('Ravi Menon', 'June Park'), 'status', 'ended')),
  ('harbour-lines',
    'A dispatcher at a struggling ferry company keeps a nightly log of the passengers no one remembers boarding.',
    '/media/posters/harbourlines.svg', '/media/backdrops/harbourlines.svg', 4.4::numeric,
    jsonb_build_object('seasons', 1, 'episodes', 8,
      'creators', jsonb_build_array('Naima Osei'), 'status', 'ongoing')),
  ('late-check-in',
    'An overnight receptionist at a chain motel narrates a very small city that only exists between 11pm and 5am.',
    '/media/posters/latecheckin.svg', null, 4.1::numeric,
    jsonb_build_object('seasons', 2, 'episodes', 20,
      'creators', jsonb_build_array('Petra Lang', 'Ola Adeyemi'), 'status', 'ongoing')),
  ('signal-glass',
    'A radio archivist restores a lost season of a 1970s children''s programme and finds a message aimed at her.',
    '/media/posters/signalglass.svg', null, 4.7::numeric,
    jsonb_build_object('seasons', 1, 'episodes', 6,
      'creators', jsonb_build_array('Halle Renard'), 'status', 'ongoing')),
  ('ridge-and-river',
    'A rural veterinarian and a river-boat pilot keep meeting on emergency calls that neither of them officially took.',
    '/media/posters/ridgeandriver.svg', null, 3.8::numeric,
    jsonb_build_object('seasons', 4, 'episodes', 40,
      'creators', jsonb_build_array('Nate Oduya'), 'status', 'ended')),
  ('paper-watch',
    'The overnight desk of a struggling regional newspaper tries to keep a print edition alive one story at a time.',
    '/media/posters/paperwatch.svg', null, 4.3::numeric,
    jsonb_build_object('seasons', 2, 'episodes', 18,
      'creators', jsonb_build_array('Amara Voss', 'Sten Halvorsen'), 'status', 'ongoing')),
  ('under-the-eaves',
    'Four flatmates in a converted attic try to keep a shared kitchen, a shared cat, and a shared secret from collapsing.',
    '/media/posters/undertheeaves.svg', null, 4.2::numeric,
    jsonb_build_object('seasons', 3, 'episodes', 30,
      'creators', jsonb_build_array('Wren Aldana'), 'status', 'ended'))
) as v(slug, synopsis, poster_url, backdrop_url, average_rating, details)
where mi.slug = v.slug;

-- --- Books ------------------------------------------------------------------
update public.media_items as mi set
  synopsis = v.synopsis,
  subtitle = v.subtitle,
  poster_url = v.poster_url,
  backdrop_url = v.backdrop_url,
  average_rating = v.average_rating,
  details = v.details,
  updated_at = now()
from (values
  ('the-small-hours',
    'A translator working the graveyard shift at an international news wire finds a message she was never meant to receive.',
    'A Novel', '/media/posters/smallhours.svg', null, 4.4::numeric,
    jsonb_build_object('authors', jsonb_build_array('Camille Aro'),
      'pageCount', 312, 'publisher', 'Blackpine Press')),
  ('orbital-notes',
    'Essays on maps, memory, and the strange work of noticing things twice.',
    null, '/media/posters/orbitalnotes.svg', null, 4.2::numeric,
    jsonb_build_object('authors', jsonb_build_array('Devon Halle'),
      'pageCount', 224)),
  ('the-bright-index',
    'A librarian in a defunded archive begins cataloguing books that do not exist yet.',
    null, '/media/posters/brightindex.svg', '/media/backdrops/brightindex.svg', 4.5::numeric,
    jsonb_build_object('authors', jsonb_build_array('Ines Aldana'),
      'pageCount', 388, 'publisher', 'Halcyon House')),
  ('salt-tide',
    'A weather forecaster on a small island keeps a private almanac of everything the official record leaves out.',
    null, '/media/posters/salttide.svg', null, 4.3::numeric,
    jsonb_build_object('authors', jsonb_build_array('Yara Bekker'),
      'pageCount', 268, 'publisher', 'North Reef')),
  ('the-weight-of-sand',
    'Nine short stories set in desert cities, each about a person who arrives to leave a note and stays for a season.',
    'Stories', '/media/posters/theweightofsand.svg', null, 4.1::numeric,
    jsonb_build_object('authors', jsonb_build_array('Ilan Rahimi'),
      'pageCount', 196, 'publisher', 'Blackpine Press')),
  ('the-north-room',
    'A translator inherits a house whose upstairs bedroom appears in three separate 19th-century diaries she has never read.',
    null, '/media/posters/thenorthroom.svg', null, 4.6::numeric,
    jsonb_build_object('authors', jsonb_build_array('Sinead Halloran'),
      'pageCount', 342, 'publisher', 'Halcyon House')),
  ('paper-birds',
    'A retired origami master documents every fold he has ever taught, and the strangers each fold left behind.',
    null, '/media/posters/paperbirds.svg', null, 4.4::numeric,
    jsonb_build_object('authors', jsonb_build_array('Haruto Endo'),
      'pageCount', 208, 'publisher', 'Blackpine Press')),
  ('quiet-instruments',
    'Interlinked stories about a workshop that repairs the last of a rare wind instrument no one commissions any more.',
    null, '/media/posters/quietinstruments.svg', null, 4.0::numeric,
    jsonb_build_object('authors', jsonb_build_array('Marisol Vega'),
      'pageCount', 254, 'publisher', 'North Reef')),
  ('seas-of-glass',
    'A marine cartographer investigating a bleached reef finds a private survey her mother filed and then denied.',
    'A Novel', '/media/posters/seasofglass.svg', null, 4.3::numeric,
    jsonb_build_object('authors', jsonb_build_array('Ola Idris'),
      'pageCount', 396, 'publisher', 'Halcyon House')),
  ('the-slow-dial',
    'A field guide to the disappearing craft of long-form radio, told through the engineers who tuned it.',
    null, '/media/posters/theslowdial.svg', null, 3.9::numeric,
    jsonb_build_object('authors', jsonb_build_array('Perla Bianchi'),
      'pageCount', 288, 'publisher', 'Northline'))
) as v(slug, synopsis, subtitle, poster_url, backdrop_url, average_rating, details)
where mi.slug = v.slug;

-- ---------------------------------------------------------------------------
-- Lexical retrieval index.
--
-- A STORED generated tsvector on the PUBLIC catalog table. Keeping the lexical
-- index here (rather than on the private embedding table) is deliberate: it
-- lets deterministic keyword search — and the keyword-only fallback — work with
-- ZERO embeddings and no OpenAI key, since it depends only on catalog columns.
-- Weights bias title (A) over subtitle/genres (B) over synopsis/credits (C).
--
-- The two-argument to_tsvector('english'::regconfig, ...) form is IMMUTABLE (as
-- required by a generated column). Array credits live in the `details` JSONB;
-- Postgres forbids subqueries in a generated expression, so the flattening is
-- done by an IMMUTABLE helper function instead.
-- ---------------------------------------------------------------------------

-- Flatten a JSONB array of strings to a single space-joined string. Returns ''
-- for a null / non-array input. Fully schema-qualified and IMMUTABLE.
create or replace function public.jsonb_text_array_to_string(p jsonb)
returns text
language sql
immutable
as $$
  select coalesce(pg_catalog.string_agg(value, ' '), '')
  from pg_catalog.jsonb_array_elements_text(
    case pg_catalog.jsonb_typeof(p) when 'array' then p else '[]'::jsonb end
  ) as value
$$;

comment on function public.jsonb_text_array_to_string(jsonb) is
  'IMMUTABLE helper: flattens a JSONB string array to a space-joined string (empty for null/non-array). Used to build the media_items search document.';

-- Build the weighted search document for a media row. Wrapping the whole
-- expression in a single IMMUTABLE function is the canonical workaround for the
-- fact that the inline text->regconfig cast (`'english'::regconfig`) is only
-- STABLE, which would otherwise make a generated-column expression non-immutable.
-- Everything is fully schema-qualified so no search_path dependence remains.
create or replace function public.media_items_search_document(
  p_title    text,
  p_subtitle text,
  p_genres   text[],
  p_synopsis text,
  p_details  jsonb
)
returns tsvector
language sql
immutable
as $$
  select
    pg_catalog.setweight(pg_catalog.to_tsvector('english'::pg_catalog.regconfig, coalesce(p_title, '')), 'A') ||
    pg_catalog.setweight(pg_catalog.to_tsvector('english'::pg_catalog.regconfig, coalesce(p_subtitle, '')), 'B') ||
    pg_catalog.setweight(pg_catalog.to_tsvector('english'::pg_catalog.regconfig, pg_catalog.array_to_string(coalesce(p_genres, '{}'), ' ')), 'B') ||
    pg_catalog.setweight(pg_catalog.to_tsvector('english'::pg_catalog.regconfig, coalesce(p_synopsis, '')), 'C') ||
    pg_catalog.setweight(pg_catalog.to_tsvector('english'::pg_catalog.regconfig, coalesce(p_details ->> 'director', '')), 'C') ||
    pg_catalog.setweight(pg_catalog.to_tsvector('english'::pg_catalog.regconfig, public.jsonb_text_array_to_string(p_details -> 'cast')), 'C') ||
    pg_catalog.setweight(pg_catalog.to_tsvector('english'::pg_catalog.regconfig, public.jsonb_text_array_to_string(p_details -> 'creators')), 'C') ||
    pg_catalog.setweight(pg_catalog.to_tsvector('english'::pg_catalog.regconfig, public.jsonb_text_array_to_string(p_details -> 'authors')), 'C')
$$;

comment on function public.media_items_search_document(text, text, text[], text, jsonb) is
  'IMMUTABLE builder for the weighted media search document (title A / subtitle+genres B / synopsis+credits C). Used by the media_items.search_tsv generated column.';

alter table public.media_items
  add column if not exists search_tsv tsvector
  generated always as (
    public.media_items_search_document(title, subtitle, genres, synopsis, details)
  ) stored;

create index if not exists media_items_search_tsv_idx
  on public.media_items using gin (search_tsv);

comment on column public.media_items.search_tsv is
  'Weighted full-text search document derived from catalog columns (title/subtitle/genres/synopsis/credits). Powers deterministic keyword retrieval and the keyword-only fallback, independent of any embedding.';
