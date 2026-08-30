/**
 * Minimal Open Library wire types.
 *
 * Only the fields the adapter reads are described, all optional — Open Library
 * records are sparse and inconsistent, so nothing is assumed present. These stay
 * INTERNAL to the adapter.
 */

/** A `search.json` result document (subset of requested fields). */
export interface OpenLibrarySearchDoc {
  key?: string; // "/works/OL...W"
  title?: string;
  author_name?: string[];
  first_publish_year?: number;
  cover_i?: number;
  subject?: string[];
}

/** The `search.json` envelope. */
export interface OpenLibrarySearchResponse {
  numFound?: number;
  start?: number;
  docs?: OpenLibrarySearchDoc[];
}

/** Open Library "type/text" description, which may be a plain string or object. */
export type OpenLibraryDescription = string | { value?: string } | undefined;

/** A `/works/{id}.json` record (subset). */
export interface OpenLibraryWork {
  key?: string;
  title?: string;
  subtitle?: string;
  description?: OpenLibraryDescription;
  subjects?: string[];
  covers?: number[];
  first_publish_date?: string;
  authors?: Array<{ author?: { key?: string } }>;
}

/** A `/authors/{id}.json` record (subset). */
export interface OpenLibraryAuthor {
  key?: string;
  name?: string;
}
