/**
 * The canonical embedding document builder.
 *
 * Given a catalog {@link MediaItem}, this produces the *exact* text that is sent
 * to the embedding provider and the deterministic content hash recorded
 * alongside the embedding. It is a pure function of catalog data only:
 *
 *   - It uses ONLY catalog fields (title, subtitle, kind, year, genres,
 *     synopsis, and the kind-appropriate credits).
 *   - It NEVER includes user-specific data (diary, reviews, favorites, lists,
 *     profiles), secrets, or mock-user attribution.
 *   - Field order and normalization are stable, so the same title always yields
 *     byte-identical text and hash across processes and environments.
 *
 * A change to the document *format* is a semantic change to every embedding, so
 * the format carries an explicit {@link CANONICAL_DOCUMENT_VERSION}. Bumping it
 * changes every content hash and therefore intentionally marks every embedding
 * stale, driving a controlled re-embed. The version is folded into the hash so
 * two documents that happen to render the same text under different format
 * versions never collide.
 */

import { createHash } from "node:crypto";

import type { MediaItem } from "@/lib/types";

/**
 * Version of the canonical document *format*. Bump this whenever the set of
 * fields, their order, or the normalization rules below change, so existing
 * embeddings are recognised as stale and re-embedded intentionally.
 */
export const CANONICAL_DOCUMENT_VERSION = "v1" as const;

/** Human-facing label for each media kind, used in the document. */
const KIND_LABEL: Record<MediaItem["kind"], string> = {
  movie: "Movie",
  tv: "TV series",
  book: "Book",
};

/** Collapse all runs of whitespace to a single space and trim the ends. */
function normalizeText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

/** Normalize, drop blanks, de-duplicate (order-preserving), and join a list. */
function normalizeList(values: readonly string[]): string {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of values) {
    const value = normalizeText(raw);
    if (value && !seen.has(value)) {
      seen.add(value);
      out.push(value);
    }
  }
  return out.join(", ");
}

/**
 * Build the canonical, embeddable document for a catalog item.
 *
 * The output is a newline-separated list of `Label: value` lines in a fixed
 * order. Absent optional fields (subtitle, empty credit lists, blank synopsis)
 * are omitted rather than emitted blank, so the text stays clean while remaining
 * fully deterministic for a given item.
 */
export function buildCanonicalDocument(item: MediaItem): string {
  const lines: string[] = [];

  lines.push(`Title: ${normalizeText(item.title)}`);

  const subtitle = item.subtitle ? normalizeText(item.subtitle) : "";
  if (subtitle) lines.push(`Subtitle: ${subtitle}`);

  lines.push(`Kind: ${KIND_LABEL[item.kind]}`);
  lines.push(`Year: ${item.year}`);

  const genres = normalizeList(item.genres);
  if (genres) lines.push(`Genres: ${genres}`);

  // Kind-specific credits, narrowed on the discriminant.
  switch (item.kind) {
    case "movie": {
      const director = normalizeText(item.director);
      if (director) lines.push(`Director: ${director}`);
      const cast = normalizeList(item.cast);
      if (cast) lines.push(`Cast: ${cast}`);
      break;
    }
    case "tv": {
      const creators = normalizeList(item.creators);
      if (creators) lines.push(`Creators: ${creators}`);
      break;
    }
    case "book": {
      const authors = normalizeList(item.authors);
      if (authors) lines.push(`Authors: ${authors}`);
      if (item.publisher) {
        const publisher = normalizeText(item.publisher);
        if (publisher) lines.push(`Publisher: ${publisher}`);
      }
      break;
    }
  }

  const synopsis = normalizeText(item.synopsis);
  if (synopsis) lines.push(`Synopsis: ${synopsis}`);

  return lines.join("\n");
}

/**
 * Deterministic content hash of a canonical document.
 *
 * The {@link CANONICAL_DOCUMENT_VERSION} is prefixed into the hashed bytes so a
 * format-version bump changes every hash (marking embeddings stale) even if the
 * rendered text is unchanged. Returns a lowercase hex SHA-256 digest.
 */
export function hashCanonicalDocument(document: string): string {
  return createHash("sha256")
    .update(`${CANONICAL_DOCUMENT_VERSION}\n${document}`, "utf8")
    .digest("hex");
}

/** Convenience: build the document and its content hash for an item in one call. */
export function canonicalDocumentFor(item: MediaItem): {
  document: string;
  contentHash: string;
} {
  const document = buildCanonicalDocument(item);
  return { document, contentHash: hashCanonicalDocument(document) };
}
