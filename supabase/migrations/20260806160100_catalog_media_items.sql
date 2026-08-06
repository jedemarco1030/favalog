-- Favalog: curated catalog identity bridge.
--
-- The consumer UI renders deterministic mock `MediaItem` records, but any
-- persistent write (a diary entry / review) needs a real UUID from
-- public.media_items. This migration gives every currently-loggable mock title
-- exactly ONE stable catalog row so the server can resolve a trusted slug to a
-- media UUID without ever accepting title metadata from the browser and without
-- creating a new media row per user log.
--
-- Identity strategy (stable + reproducible):
--   * source      = 'favalog'                (curated/internal provenance)
--   * external_id = the immutable mock id     (e.g. 'm_afterglow')
--   * id          = md5('favalog:' || external_id)::uuid
--       A deterministic UUID derived from the immutable mock identity, so the
--       same title always maps to the same catalog UUID across environments and
--       re-runs — the row is stable, never regenerated per log.
--   * slug        = the existing stable mock slug (what /title/[slug] uses)
--
-- Idempotent + forward-only: ON CONFLICT on the canonical (source, external_id)
-- identity refreshes the mutable presentation columns but never rewrites id.
-- Curated data only — no users, no diary/reviews/lists/favorites/follows. This
-- is safe to apply to any environment (it does NOT depend on seed.sql).

insert into public.media_items (id, kind, source, external_id, slug, title, year, genres)
select
  md5('favalog:' || v.external_id)::uuid,
  v.kind::public.media_kind,
  'favalog',
  v.external_id,
  v.slug,
  v.title,
  v.year,
  v.genres
from (
  values
    -- Movies
    ('m_afterglow',      'movie', 'afterglow',        'Afterglow',        2023, array['Drama','Romance']),
    ('m_paperlantern',   'movie', 'paper-lantern',    'Paper Lantern',    2021, array['Adventure','Comedy']),
    ('m_lowcountry',     'movie', 'low-country',      'Low Country',      2019, array['Mystery','Thriller']),
    ('m_duneparttwo',    'movie', 'dune-part-two',    'Dune: Part Two',   2024, array['Science Fiction','Epic']),
    ('m_quietsignal',    'movie', 'quiet-signal',     'Quiet Signal',     2022, array['Science Fiction','Thriller']),
    ('m_thecartographer','movie', 'the-cartographer', 'The Cartographer', 2023, array['Drama','Mystery']),
    ('m_nightferry',     'movie', 'night-ferry',      'Night Ferry',      2024, array['Drama','Romance']),
    ('m_arclighthouse',  'movie', 'arc-lighthouse',   'Arc Lighthouse',   2020, array['Science Fiction','Drama']),
    ('m_bluehourrun',    'movie', 'blue-hour-run',    'Blue Hour Run',    2022, array['Thriller','Action']),
    ('m_slowmountain',   'movie', 'slow-mountain',    'Slow Mountain',    2018, array['Drama','Family']),
    -- TV
    ('t_northlight',     'tv',    'northlight',       'Northlight',       2024, array['Sci-Fi','Drama']),
    ('t_gildedroom',     'tv',    'the-gilded-room',  'The Gilded Room',  2022, array['Comedy','Drama']),
    ('t_harbourlines',   'tv',    'harbour-lines',    'Harbour Lines',    2023, array['Mystery','Drama']),
    ('t_latecheckin',    'tv',    'late-check-in',    'Late Check-In',    2024, array['Comedy','Slice of Life']),
    ('t_signalglass',    'tv',    'signal-glass',     'Signal Glass',     2025, array['Mystery','Sci-Fi']),
    ('t_ridgeandriver',  'tv',    'ridge-and-river',  'Ridge and River',  2021, array['Drama','Romance']),
    ('t_paperwatch',     'tv',    'paper-watch',      'Paper Watch',      2023, array['Drama']),
    ('t_undertheeaves',  'tv',    'under-the-eaves',  'Under the Eaves',  2019, array['Comedy','Slice of Life']),
    -- Books
    ('b_smallhours',      'book', 'the-small-hours',   'The Small Hours',   2020, array['Literary Fiction']),
    ('b_orbital_notes',   'book', 'orbital-notes',     'Orbital Notes',     2018, array['Essays','Nonfiction']),
    ('b_bright_index',    'book', 'the-bright-index',  'The Bright Index',  2024, array['Speculative','Literary Fiction']),
    ('b_salt_tide',       'book', 'salt-tide',         'Salt Tide',         2022, array['Literary Fiction']),
    ('b_weight_of_sand',  'book', 'the-weight-of-sand','The Weight of Sand',2021, array['Short Stories']),
    ('b_northroom',       'book', 'the-north-room',    'The North Room',    2025, array['Literary Fiction','Mystery']),
    ('b_paperbirds',      'book', 'paper-birds',       'Paper Birds',       2017, array['Memoir','Essays']),
    ('b_quietinstruments','book', 'quiet-instruments', 'Quiet Instruments', 2023, array['Short Stories','Literary Fiction']),
    ('b_seasofglass',     'book', 'seas-of-glass',     'Seas of Glass',     2024, array['Literary Fiction','Science Fiction']),
    ('b_theslowdial',     'book', 'the-slow-dial',     'The Slow Dial',     2016, array['Nonfiction','History'])
) as v(external_id, kind, slug, title, year, genres)
on conflict (source, external_id) do update
  set kind    = excluded.kind,
      slug    = excluded.slug,
      title   = excluded.title,
      year    = excluded.year,
      genres  = excluded.genres,
      updated_at = now();
