/**
 * Pure Open Library → provider-neutral normalization.
 *
 * Translates the sparse Open Library Work + author records into Favalog's
 * bounded normalized book type. Pure and defensive: an absent cover, missing
 * description, missing year, or empty author list all degrade gracefully rather
 * than throwing. No unbounded text or array is produced.
 */

import {
  MAX_AUTHORS,
  MAX_SUBTITLE_LENGTH,
  MAX_SYNOPSIS_LENGTH,
  MAX_TITLE_LENGTH,
} from "../config.ts";
import {
  capGenres,
  capList,
  capText,
  coerceYear,
} from "../normalize-helpers.ts";
import type { CatalogSearchCandidate, NormalizedMediaItem } from "../types";
import { openLibraryCoverUrl, workKeyToId } from "./config.ts";
import type {
  OpenLibraryDescription,
  OpenLibrarySearchDoc,
  OpenLibraryWork,
} from "./types";

/** Resolve Open Library's string-or-object description into plain text. */
export function descriptionText(description: OpenLibraryDescription): string {
  if (typeof description === "string")
    return capText(description, MAX_SYNOPSIS_LENGTH);
  if (description && typeof description === "object") {
    return capText(description.value, MAX_SYNOPSIS_LENGTH);
  }
  return "";
}

/**
 * Normalize a Work record (plus its already-resolved author names) into a
 * {@link NormalizedMediaItem}. Year is taken from the Work's
 * `first_publish_date`; when the Work lacks one, `year` is 0 and the
 * materialization boundary rejects it with a clear validation error rather than
 * inventing a date.
 */
export function normalizeOpenLibraryWork(
  work: OpenLibraryWork,
  authorNames: readonly string[],
): NormalizedMediaItem {
  const workId = workKeyToId(work.key) ?? "";
  const title = capText(work.title, MAX_TITLE_LENGTH);
  const subtitle = capText(work.subtitle, MAX_SUBTITLE_LENGTH) || undefined;
  const coverId = Array.isArray(work.covers) ? work.covers[0] : undefined;

  return {
    ref: { provider: "openlibrary", kind: "book", externalId: workId },
    kind: "book",
    title,
    subtitle,
    synopsis: descriptionText(work.description),
    year: coerceYear(work.first_publish_date) ?? 0,
    genres: capGenres(work.subjects),
    posterUrl: openLibraryCoverUrl(coverId),
    authors: capList([...authorNames], MAX_AUTHORS),
    // Open Library page count is edition-specific, not a Work property; a Work
    // has no single canonical page count, so it stays 0 in this phase.
    pageCount: 0,
  };
}

/**
 * Normalize an Open Library search document into a candidate, or `null` when it
 * lacks a resolvable Work id / title.
 */
export function normalizeOpenLibrarySearchDoc(
  doc: OpenLibrarySearchDoc,
): CatalogSearchCandidate | null {
  const workId = workKeyToId(doc.key);
  const title = capText(doc.title, MAX_TITLE_LENGTH);
  if (!workId || !title) return null;
  return {
    ref: { provider: "openlibrary", kind: "book", externalId: workId },
    kind: "book",
    title,
    year: coerceYear(doc.first_publish_year),
    posterUrl: openLibraryCoverUrl(doc.cover_i),
  };
}

/** Extract the (capped) list of author keys to resolve for a Work. */
export function authorKeysFromWork(work: OpenLibraryWork): string[] {
  if (!Array.isArray(work.authors)) return [];
  const keys: string[] = [];
  for (const entry of work.authors) {
    if (keys.length >= MAX_AUTHORS) break;
    const key = entry?.author?.key;
    if (typeof key === "string" && /^\/authors\/OL\d+A$/.test(key.trim())) {
      keys.push(key.trim());
    }
  }
  return keys;
}
