import { describe, expect, it } from "vitest";

import { CANONICAL_BOOK_GENRES } from "@/lib/catalog/openlibrary/genres";
import {
  BOOK_GENRES,
  SCREEN_GENRES,
  canonicalizeBrowseGenre,
  isAllowedBrowseGenre,
} from "./genre-vocabulary";

/**
 * The exact polluted values from the reported production defect, plus other
 * classes of non-genre subject that must never reach the Genre dropdown.
 */
const POLLUTED_SUBJECTS = [
  "award:nebula_award=novel", // award metadata + provider syntax
  "nyt:mass-market-monthly=2021-11-07", // bestseller list + date
  "Dune (Imaginary place)", // place entity
  "Dune (imaginary place), fiction", // entity + prose
  "Fiction, science fiction, general", // cataloguing prose composite
  "Accessible book", // library prose
  "Protected DAISY", // library prose
  "In library", // library prose
  "1979", // bare year
  "subject=fiction", // provider query syntax
  "Frank Herbert", // person entity
];

describe("browse genre vocabulary", () => {
  it("book vocabulary is exactly the canonical book taxonomy", () => {
    expect(BOOK_GENRES).toBe(CANONICAL_BOOK_GENRES);
  });

  it("accepts canonical book genres for the book kind", () => {
    for (const genre of CANONICAL_BOOK_GENRES) {
      expect(isAllowedBrowseGenre("book", genre)).toBe(true);
    }
  });

  it("accepts every screen genre for movie and tv kinds", () => {
    for (const genre of SCREEN_GENRES) {
      expect(isAllowedBrowseGenre("movie", genre)).toBe(true);
      expect(isAllowedBrowseGenre("tv", genre)).toBe(true);
    }
  });

  it("preserves the curated catalog's screen spellings", () => {
    for (const genre of [
      "Sci-Fi",
      "Epic",
      "Slice of Life",
      "Science Fiction",
    ]) {
      expect(isAllowedBrowseGenre("movie", genre)).toBe(true);
    }
  });

  it("is case- and whitespace-insensitive and canonicalizes display", () => {
    expect(canonicalizeBrowseGenre("book", "  science FICTION ")).toBe(
      "Science Fiction",
    );
    expect(canonicalizeBrowseGenre("movie", "sci-fi")).toBe("Sci-Fi");
    expect(canonicalizeBrowseGenre("tv", "DRAMA")).toBe("Drama");
  });

  it("rejects a book genre requested against the screen vocabulary and vice versa", () => {
    // "Memoir" is a book genre; not a screen genre.
    expect(isAllowedBrowseGenre("movie", "Memoir")).toBe(false);
    expect(isAllowedBrowseGenre("tv", "Literary Fiction")).toBe(false);
    // "Western" is a screen genre; not a book genre.
    expect(isAllowedBrowseGenre("book", "Western")).toBe(false);
  });

  it("admits the union across kinds when browsing all (kind null)", () => {
    expect(isAllowedBrowseGenre(null, "Memoir")).toBe(true); // book
    expect(isAllowedBrowseGenre(null, "Western")).toBe(true); // screen
    expect(isAllowedBrowseGenre(null, "Science Fiction")).toBe(true); // shared
  });

  describe("fail-closed rejection of polluted historical subjects", () => {
    for (const subject of POLLUTED_SUBJECTS) {
      it(`rejects ${JSON.stringify(subject)} for every kind`, () => {
        expect(isAllowedBrowseGenre("book", subject)).toBe(false);
        expect(isAllowedBrowseGenre("movie", subject)).toBe(false);
        expect(isAllowedBrowseGenre("tv", subject)).toBe(false);
        expect(isAllowedBrowseGenre(null, subject)).toBe(false);
        expect(canonicalizeBrowseGenre(null, subject)).toBeNull();
      });
    }
  });

  it("rejects blank / non-string input", () => {
    expect(canonicalizeBrowseGenre("book", "")).toBeNull();
    expect(canonicalizeBrowseGenre("book", "   ")).toBeNull();
    expect(canonicalizeBrowseGenre("book", 42 as unknown as string)).toBeNull();
  });
});
