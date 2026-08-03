import type { Book, MediaItem, Movie, TVShow } from "@/lib/types";

/**
 * Mock media catalog. Poster/backdrop URLs point at local SVG placeholders
 * under /public/media so the app remains fully offline and Lighthouse-friendly.
 *
 * When wiring up a real backend, replace this module with a data fetcher that
 * returns the same `MediaItem` shape (e.g. a server action or a fetch call in
 * a Server Component). Nothing in the UI layer imports the raw arrays directly.
 */

export const movies: Movie[] = [
  {
    id: "m_afterglow",
    slug: "afterglow",
    kind: "movie",
    title: "Afterglow",
    synopsis:
      "A composer returns to the coastal town where she grew up and confronts a summer that has quietly refused to end.",
    year: 2023,
    posterUrl: "/media/posters/afterglow.svg",
    backdropUrl: "/media/backdrops/afterglow.svg",
    averageRating: 4.3,
    genres: ["Drama", "Romance"],
    runtimeMinutes: 118,
    director: "Noor Salim",
    cast: ["Iris Vale", "Teodoro Bassi", "Hana Lundgren"],
  },
  {
    id: "m_paperlantern",
    slug: "paper-lantern",
    kind: "movie",
    title: "Paper Lantern",
    synopsis:
      "Two rival cartographers race across a fictional Mediterranean to redraw a border that no one asked them to redraw.",
    year: 2021,
    posterUrl: "/media/posters/paperlantern.svg",
    averageRating: 3.9,
    genres: ["Adventure", "Comedy"],
    runtimeMinutes: 104,
    director: "Priya Deshmukh",
    cast: ["Wren Ashby", "Kai Nomura"],
  },
  {
    id: "m_lowcountry",
    slug: "low-country",
    kind: "movie",
    title: "Low Country",
    synopsis:
      "A retired detective is pulled into a case that has been solved four separate times, each time incorrectly.",
    year: 2019,
    posterUrl: "/media/posters/lowcountry.svg",
    averageRating: 4.1,
    genres: ["Mystery", "Thriller"],
    runtimeMinutes: 132,
    director: "Emil Trakas",
    cast: ["Odette Rowe", "Marcus Bell"],
  },
  {
    id: "m_duneparttwo",
    slug: "dune-part-two",
    kind: "movie",
    title: "Dune: Part Two",
    synopsis:
      "The second half of a desert epic. A young heir chooses which prophecy to inhabit and which one to burn.",
    year: 2024,
    posterUrl: "/media/posters/duneparttwo.svg",
    backdropUrl: "/media/backdrops/duneparttwo.svg",
    averageRating: 4.7,
    genres: ["Science Fiction", "Epic"],
    runtimeMinutes: 166,
    director: "Denis V. (mock)",
    cast: ["Paul A.", "Chani F.", "Feyd R."],
  },
  {
    id: "m_quietsignal",
    slug: "quiet-signal",
    kind: "movie",
    title: "Quiet Signal",
    synopsis:
      "An acoustic engineer helping a submarine crew begins hearing a voice on a channel that shouldn't have one.",
    year: 2022,
    posterUrl: "/media/posters/quietsignal.svg",
    averageRating: 4.0,
    genres: ["Science Fiction", "Thriller"],
    runtimeMinutes: 121,
    director: "Iona Petraki",
    cast: ["Lena Voss", "Rhys Amare"],
  },
  {
    id: "m_thecartographer",
    slug: "the-cartographer",
    kind: "movie",
    title: "The Cartographer",
    synopsis:
      "A woman who draws maps for governments that no longer exist takes on a private commission she cannot verify.",
    year: 2023,
    posterUrl: "/media/posters/thecartographer.svg",
    averageRating: 4.2,
    genres: ["Drama", "Mystery"],
    runtimeMinutes: 109,
    director: "Adaeze Umeh",
    cast: ["Naomi Ackie‑style lead", "Colm Bergin"],
  },
  {
    id: "m_nightferry",
    slug: "night-ferry",
    kind: "movie",
    title: "Night Ferry",
    synopsis:
      "A single overnight crossing between two coastal cities, told through the six passengers who miss the same person.",
    year: 2024,
    posterUrl: "/media/posters/nightferry.svg",
    averageRating: 4.5,
    genres: ["Drama", "Romance"],
    runtimeMinutes: 112,
    director: "Livia Marchetti",
    cast: ["Rowan Kade", "Mira Osei"],
  },
  {
    id: "m_arclighthouse",
    slug: "arc-lighthouse",
    kind: "movie",
    title: "Arc Lighthouse",
    synopsis:
      "A retired astronomer inherits a coastal lighthouse and slowly notices that the beam is answering something offshore.",
    year: 2020,
    posterUrl: "/media/posters/arclighthouse.svg",
    averageRating: 4.0,
    genres: ["Science Fiction", "Drama"],
    runtimeMinutes: 116,
    director: "Ines Cortez",
    cast: ["Bram Solberg", "Anya Duras"],
  },
  {
    id: "m_bluehourrun",
    slug: "blue-hour-run",
    kind: "movie",
    title: "Blue Hour Run",
    synopsis:
      "A courier with a hairline crack in a rare vinyl acetate has one dawn to deliver it across a shuttered city.",
    year: 2022,
    posterUrl: "/media/posters/bluehourrun.svg",
    averageRating: 3.7,
    genres: ["Thriller", "Action"],
    runtimeMinutes: 98,
    director: "Kenji Aoki",
    cast: ["Tomas Riel", "Sena Ovadia"],
  },
  {
    id: "m_slowmountain",
    slug: "slow-mountain",
    kind: "movie",
    title: "Slow Mountain",
    synopsis:
      "Three cousins hike the family peak one last time before the ridge is sold off, and quietly renegotiate everything unsaid.",
    year: 2018,
    posterUrl: "/media/posters/slowmountain.svg",
    averageRating: 4.4,
    genres: ["Drama", "Family"],
    runtimeMinutes: 124,
    director: "Rafael Bento",
    cast: ["Isabela Cruz", "Diogo Serra", "Vera Almeida"],
  },
];

export const tvShows: TVShow[] = [
  {
    id: "t_northlight",
    slug: "northlight",
    kind: "tv",
    title: "Northlight",
    synopsis:
      "In a town where the sun never fully sets, a young marine biologist begins receiving letters from someone who claims to be her.",
    year: 2024,
    posterUrl: "/media/posters/northlight.svg",
    backdropUrl: "/media/backdrops/northlight.svg",
    averageRating: 4.6,
    genres: ["Sci-Fi", "Drama"],
    seasons: 2,
    episodes: 16,
    creators: ["Sana Ito"],
    status: "ongoing",
  },
  {
    id: "t_gildedroom",
    slug: "the-gilded-room",
    kind: "tv",
    title: "The Gilded Room",
    synopsis:
      "Four strangers inherit an unusable hotel on the outskirts of a city that has slowly forgotten it exists.",
    year: 2022,
    posterUrl: "/media/posters/gildedroom.svg",
    averageRating: 4.0,
    genres: ["Comedy", "Drama"],
    seasons: 3,
    episodes: 24,
    creators: ["Ravi Menon", "June Park"],
    status: "ended",
  },
  {
    id: "t_harbourlines",
    slug: "harbour-lines",
    kind: "tv",
    title: "Harbour Lines",
    synopsis:
      "A dispatcher at a struggling ferry company keeps a nightly log of the passengers no one remembers boarding.",
    year: 2023,
    posterUrl: "/media/posters/harbourlines.svg",
    backdropUrl: "/media/backdrops/harbourlines.svg",
    averageRating: 4.4,
    genres: ["Mystery", "Drama"],
    seasons: 1,
    episodes: 8,
    creators: ["Naima Osei"],
    status: "ongoing",
  },
  {
    id: "t_latecheckin",
    slug: "late-check-in",
    kind: "tv",
    title: "Late Check-In",
    synopsis:
      "An overnight receptionist at a chain motel narrates a very small city that only exists between 11pm and 5am.",
    year: 2024,
    posterUrl: "/media/posters/latecheckin.svg",
    averageRating: 4.1,
    genres: ["Comedy", "Slice of Life"],
    seasons: 2,
    episodes: 20,
    creators: ["Petra Lang", "Ola Adeyemi"],
    status: "ongoing",
  },
  {
    id: "t_signalglass",
    slug: "signal-glass",
    kind: "tv",
    title: "Signal Glass",
    synopsis:
      "A radio archivist restores a lost season of a 1970s children's programme and finds a message aimed at her.",
    year: 2025,
    posterUrl: "/media/posters/signalglass.svg",
    averageRating: 4.7,
    genres: ["Mystery", "Sci-Fi"],
    seasons: 1,
    episodes: 6,
    creators: ["Halle Renard"],
    status: "ongoing",
  },
  {
    id: "t_ridgeandriver",
    slug: "ridge-and-river",
    kind: "tv",
    title: "Ridge and River",
    synopsis:
      "A rural veterinarian and a river-boat pilot keep meeting on emergency calls that neither of them officially took.",
    year: 2021,
    posterUrl: "/media/posters/ridgeandriver.svg",
    averageRating: 3.8,
    genres: ["Drama", "Romance"],
    seasons: 4,
    episodes: 40,
    creators: ["Nate Oduya"],
    status: "ended",
  },
  {
    id: "t_paperwatch",
    slug: "paper-watch",
    kind: "tv",
    title: "Paper Watch",
    synopsis:
      "The overnight desk of a struggling regional newspaper tries to keep a print edition alive one story at a time.",
    year: 2023,
    posterUrl: "/media/posters/paperwatch.svg",
    averageRating: 4.3,
    genres: ["Drama"],
    seasons: 2,
    episodes: 18,
    creators: ["Amara Voss", "Sten Halvorsen"],
    status: "ongoing",
  },
  {
    id: "t_undertheeaves",
    slug: "under-the-eaves",
    kind: "tv",
    title: "Under the Eaves",
    synopsis:
      "Four flatmates in a converted attic try to keep a shared kitchen, a shared cat, and a shared secret from collapsing.",
    year: 2019,
    posterUrl: "/media/posters/undertheeaves.svg",
    averageRating: 4.2,
    genres: ["Comedy", "Slice of Life"],
    seasons: 3,
    episodes: 30,
    creators: ["Wren Aldana"],
    status: "ended",
  },
];

export const books: Book[] = [
  {
    id: "b_smallhours",
    slug: "the-small-hours",
    kind: "book",
    title: "The Small Hours",
    subtitle: "A Novel",
    synopsis:
      "A translator working the graveyard shift at an international news wire finds a message she was never meant to receive.",
    year: 2020,
    posterUrl: "/media/posters/smallhours.svg",
    averageRating: 4.4,
    genres: ["Literary Fiction"],
    authors: ["Camille Aro"],
    pageCount: 312,
    publisher: "Blackpine Press",
  },
  {
    id: "b_orbital_notes",
    slug: "orbital-notes",
    kind: "book",
    title: "Orbital Notes",
    synopsis:
      "Essays on maps, memory, and the strange work of noticing things twice.",
    year: 2018,
    posterUrl: "/media/posters/orbitalnotes.svg",
    averageRating: 4.2,
    genres: ["Essays", "Nonfiction"],
    authors: ["Devon Halle"],
    pageCount: 224,
  },
  {
    id: "b_bright_index",
    slug: "the-bright-index",
    kind: "book",
    title: "The Bright Index",
    synopsis:
      "A librarian in a defunded archive begins cataloguing books that do not exist yet.",
    year: 2024,
    posterUrl: "/media/posters/brightindex.svg",
    backdropUrl: "/media/backdrops/brightindex.svg",
    averageRating: 4.5,
    genres: ["Speculative", "Literary Fiction"],
    authors: ["Ines Aldana"],
    pageCount: 388,
    publisher: "Halcyon House",
  },
  {
    id: "b_salt_tide",
    slug: "salt-tide",
    kind: "book",
    title: "Salt Tide",
    synopsis:
      "A weather forecaster on a small island keeps a private almanac of everything the official record leaves out.",
    year: 2022,
    posterUrl: "/media/posters/salttide.svg",
    averageRating: 4.3,
    genres: ["Literary Fiction"],
    authors: ["Yara Bekker"],
    pageCount: 268,
    publisher: "North Reef",
  },
  {
    id: "b_weight_of_sand",
    slug: "the-weight-of-sand",
    kind: "book",
    title: "The Weight of Sand",
    subtitle: "Stories",
    synopsis:
      "Nine short stories set in desert cities, each about a person who arrives to leave a note and stays for a season.",
    year: 2021,
    posterUrl: "/media/posters/theweightofsand.svg",
    averageRating: 4.1,
    genres: ["Short Stories"],
    authors: ["Ilan Rahimi"],
    pageCount: 196,
    publisher: "Blackpine Press",
  },
  {
    id: "b_northroom",
    slug: "the-north-room",
    kind: "book",
    title: "The North Room",
    synopsis:
      "A translator inherits a house whose upstairs bedroom appears in three separate 19th-century diaries she has never read.",
    year: 2025,
    posterUrl: "/media/posters/thenorthroom.svg",
    averageRating: 4.6,
    genres: ["Literary Fiction", "Mystery"],
    authors: ["Sinead Halloran"],
    pageCount: 342,
    publisher: "Halcyon House",
  },
  {
    id: "b_paperbirds",
    slug: "paper-birds",
    kind: "book",
    title: "Paper Birds",
    synopsis:
      "A retired origami master documents every fold he has ever taught, and the strangers each fold left behind.",
    year: 2017,
    posterUrl: "/media/posters/paperbirds.svg",
    averageRating: 4.4,
    genres: ["Memoir", "Essays"],
    authors: ["Haruto Endo"],
    pageCount: 208,
    publisher: "Blackpine Press",
  },
  {
    id: "b_quietinstruments",
    slug: "quiet-instruments",
    kind: "book",
    title: "Quiet Instruments",
    synopsis:
      "Interlinked stories about a workshop that repairs the last of a rare wind instrument no one commissions any more.",
    year: 2023,
    posterUrl: "/media/posters/quietinstruments.svg",
    averageRating: 4.0,
    genres: ["Short Stories", "Literary Fiction"],
    authors: ["Marisol Vega"],
    pageCount: 254,
    publisher: "North Reef",
  },
  {
    id: "b_seasofglass",
    slug: "seas-of-glass",
    kind: "book",
    title: "Seas of Glass",
    subtitle: "A Novel",
    synopsis:
      "A marine cartographer investigating a bleached reef finds a private survey her mother filed and then denied.",
    year: 2024,
    posterUrl: "/media/posters/seasofglass.svg",
    averageRating: 4.3,
    genres: ["Literary Fiction", "Science Fiction"],
    authors: ["Ola Idris"],
    pageCount: 396,
    publisher: "Halcyon House",
  },
  {
    id: "b_theslowdial",
    slug: "the-slow-dial",
    kind: "book",
    title: "The Slow Dial",
    synopsis:
      "A field guide to the disappearing craft of long-form radio, told through the engineers who tuned it.",
    year: 2016,
    posterUrl: "/media/posters/theslowdial.svg",
    averageRating: 3.9,
    genres: ["Nonfiction", "History"],
    authors: ["Perla Bianchi"],
    pageCount: 288,
    publisher: "Northline",
  },
];

export const mediaItems: MediaItem[] = [...movies, ...tvShows, ...books];

export function getMediaById(id: string): MediaItem | undefined {
  return mediaItems.find((item) => item.id === id);
}

export function getMediaBySlug(slug: string): MediaItem | undefined {
  return mediaItems.find((item) => item.slug === slug);
}

export function getMediaByKind(kind: MediaItem["kind"]): MediaItem[] {
  return mediaItems.filter((item) => item.kind === kind);
}

/** All titles across every media kind. Convenience alias for consumers. */
export function getAllMedia(): MediaItem[] {
  return mediaItems;
}

/**
 * Editorial "trending" mix — interleaves movies, TV, and books so the row
 * visibly demonstrates that all three coexist in Favalog. Deterministic.
 */
export function getTrendingMedia(limit = 10): MediaItem[] {
  const zipped: MediaItem[] = [];
  const max = Math.max(movies.length, tvShows.length, books.length);
  for (let i = 0; i < max; i++) {
    if (movies[i]) zipped.push(movies[i]);
    if (tvShows[i]) zipped.push(tvShows[i]);
    if (books[i]) zipped.push(books[i]);
  }
  return zipped.slice(0, limit);
}

function byRatingDesc(a: MediaItem, b: MediaItem): number {
  return (b.averageRating ?? 0) - (a.averageRating ?? 0);
}

function byYearDesc(a: MediaItem, b: MediaItem): number {
  return b.year - a.year;
}

export function getPopularMovies(limit = 5): Movie[] {
  return [...movies].sort(byRatingDesc).slice(0, limit);
}

export function getPopularTV(limit = 5): TVShow[] {
  return [...tvShows].sort(byRatingDesc).slice(0, limit);
}

export function getPopularBooks(limit = 5): Book[] {
  return [...books].sort(byRatingDesc).slice(0, limit);
}

/**
 * Titles with the strongest community ratings, mixed across kinds. Uses the
 * existing `averageRating` field instead of duplicating a separate catalog.
 */
export function getCriticallyAcclaimed(limit = 5): MediaItem[] {
  return [...mediaItems]
    .filter((item) => (item.averageRating ?? 0) >= 4.3)
    .sort(byRatingDesc)
    .slice(0, limit);
}

/**
 * Recent releases across kinds, ordered by publication/release year. Kept
 * simple and deterministic — no runtime clock lookups.
 */
export function getNewAndNoteworthy(limit = 5): MediaItem[] {
  return [...mediaItems].sort(byYearDesc).slice(0, limit);
}

/**
 * Editorial "hidden gems" shelf. Explicit curation lives in the data layer
 * because there is not enough real popularity signal to derive it from the
 * mock catalog alone.
 */
const hiddenGemIds: readonly string[] = [
  "m_slowmountain",
  "b_paperbirds",
  "t_undertheeaves",
  "m_arclighthouse",
  "b_theslowdial",
  "t_ridgeandriver",
] as const;

export function getHiddenGems(): MediaItem[] {
  return hiddenGemIds
    .map((id) => getMediaById(id))
    .filter((item): item is MediaItem => Boolean(item));
}

/**
 * The searchable strings for a `MediaItem`: title, subtitle, genres, and
 * the creator-role appropriate to the kind. Kept in the data layer so the
 * UI never has to know which discriminant carries which credit.
 */
export function searchTermsFor(item: MediaItem): string[] {
  const terms: string[] = [item.title, ...item.genres];
  if (item.subtitle) terms.push(item.subtitle);
  switch (item.kind) {
    case "movie":
      terms.push(item.director, ...item.cast);
      break;
    case "tv":
      terms.push(...item.creators);
      break;
    case "book":
      terms.push(...item.authors);
      break;
  }
  return terms;
}
