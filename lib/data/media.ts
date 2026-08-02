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
];

export const tvShows: TVShow[] = [
  {
    id: "t_northlight",
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
];

export const books: Book[] = [
  {
    id: "b_smallhours",
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
];

export const mediaItems: MediaItem[] = [...movies, ...tvShows, ...books];

export function getMediaById(id: string): MediaItem | undefined {
  return mediaItems.find((item) => item.id === id);
}

export function getMediaByKind(kind: MediaItem["kind"]): MediaItem[] {
  return mediaItems.filter((item) => item.kind === kind);
}
