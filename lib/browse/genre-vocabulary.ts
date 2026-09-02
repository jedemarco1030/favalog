/**
 * Closed, per-kind product-genre vocabulary for the Explore *browse* Genre
 * control — a defense-in-depth boundary on the READ side.
 *
 * The canonical genre cleanup happens at the Open Library normalization boundary
 * (`@/lib/catalog/openlibrary/genres`), and the corrected
 * `materialize_external_media` refresh keeps already-imported rows clean. But a
 * historical or malformed row could still hold raw provider subjects
 * (`award:nebula_award=novel`, `Dune (Imaginary place)`,
 * `Fiction, science fiction, general`, dates, bestseller-list ids, prose, …).
 * This module guarantees such values can NEVER reach the Genre dropdown, no
 * matter what is stored:
 *
 *   - Dropdown options are derived ONLY from a closed product vocabulary
 *     appropriate to the media kind — never from the raw stored strings.
 *   - Book rows admit only the canonical Favalog book taxonomy
 *     ({@link CANONICAL_BOOK_GENRES}); movie/TV rows admit only the closed
 *     screen vocabulary ({@link SCREEN_GENRES}).
 *   - Browsing "All" (no media-type filter) admits the UNION across kinds.
 *   - Matching is case- and whitespace-insensitive and FAIL-CLOSED: an unknown
 *     value is dropped, never guessed. This is a real product taxonomy, not a
 *     regex against the visible bad examples.
 *
 * It is pure and I/O-free so it can be unit-tested and shared between the browse
 * DAL and any future consumer.
 */

import { CANONICAL_BOOK_GENRES } from "@/lib/catalog/openlibrary/genres";
import { normalizeGenreKey } from "./query";

/** A concrete media kind, or `null` for no media-type narrowing (browse "All"). */
export type BrowseKind = "movie" | "tv" | "book" | null;

/**
 * The closed, user-facing vocabulary of movie/TV (screen) genres. It is the
 * union of the spellings the curated catalog actually uses (`Epic`, `Sci-Fi`,
 * `Slice of Life`, …) and the standard provider (TMDB) movie + TV genre names,
 * so every genuine screen genre is preserved while anything else is rejected.
 *
 * Kept deliberately as a single screen set (rather than separate movie/TV sets)
 * because the browse control filters by kind at the query level; a value valid
 * for either movie or TV is a valid screen genre.
 */
export const SCREEN_GENRES = [
  "Action",
  "Action & Adventure",
  "Adventure",
  "Animation",
  "Comedy",
  "Crime",
  "Documentary",
  "Drama",
  "Epic",
  "Family",
  "Fantasy",
  "History",
  "Horror",
  "Kids",
  "Music",
  "Musical",
  "Mystery",
  "News",
  "Reality",
  "Romance",
  "Sci-Fi",
  "Sci-Fi & Fantasy",
  "Science Fiction",
  "Slice of Life",
  "Soap",
  "Talk",
  "Thriller",
  "War",
  "War & Politics",
  "Western",
] as const;

/** The closed book browse vocabulary — the canonical Favalog book taxonomy. */
export const BOOK_GENRES = CANONICAL_BOOK_GENRES;

/**
 * Build a normalized-key → canonical-display lookup for a set of canonical
 * genres. The key is the case/whitespace-insensitive comparison key so a stored
 * value of any casing resolves to the single canonical display value.
 */
function toVocabularyMap(
  genres: readonly string[],
): ReadonlyMap<string, string> {
  const map = new Map<string, string>();
  for (const genre of genres) {
    const key = normalizeGenreKey(genre);
    if (!map.has(key)) map.set(key, genre);
  }
  return map;
}

const SCREEN_MAP = toVocabularyMap(SCREEN_GENRES);
const BOOK_MAP = toVocabularyMap(BOOK_GENRES);
// Browse "All": the union of every kind's canonical vocabulary. Screen entries
// are inserted first so a shared key keeps a stable, deterministic display.
const ALL_MAP = toVocabularyMap([...SCREEN_GENRES, ...BOOK_GENRES]);

/** The normalized-key → canonical-display vocabulary for a browse kind. */
function vocabularyFor(kind: BrowseKind): ReadonlyMap<string, string> {
  switch (kind) {
    case "book":
      return BOOK_MAP;
    case "movie":
    case "tv":
      return SCREEN_MAP;
    case null:
      return ALL_MAP;
    default: {
      const exhaustive: never = kind;
      throw new Error(`Unknown browse kind: ${String(exhaustive)}`);
    }
  }
}

/**
 * Resolve a single raw stored genre to its canonical display value for the given
 * browse kind, or `null` when it is not a recognised product genre for that kind
 * (the fail-closed default). Case- and whitespace-insensitive.
 */
export function canonicalizeBrowseGenre(
  kind: BrowseKind,
  stored: string,
): string | null {
  if (typeof stored !== "string") return null;
  const trimmed = stored.trim();
  if (trimmed.length === 0) return null;
  return vocabularyFor(kind).get(normalizeGenreKey(trimmed)) ?? null;
}

/**
 * Whether a stored genre is an allowed product genre for the given browse kind.
 * Fail-closed: unknown values (raw subjects, awards, dates, entities, provider
 * query syntax, prose) return `false`.
 */
export function isAllowedBrowseGenre(
  kind: BrowseKind,
  stored: string,
): boolean {
  return canonicalizeBrowseGenre(kind, stored) !== null;
}
