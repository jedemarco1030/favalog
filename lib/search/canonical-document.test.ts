import { describe, expect, it } from "vitest";

import {
  CANONICAL_DOCUMENT_VERSION,
  buildCanonicalDocument,
  canonicalDocumentFor,
  hashCanonicalDocument,
} from "@/lib/search/canonical-document";
import type { Book, Movie, TVShow } from "@/lib/types";

function makeMovie(overrides: Partial<Movie> = {}): Movie {
  return {
    id: "m1",
    slug: "afterglow",
    kind: "movie",
    title: "Afterglow",
    synopsis: "A quiet drama.",
    year: 2023,
    posterUrl: "/media/posters/afterglow.svg",
    genres: ["Drama"],
    runtimeMinutes: 118,
    director: "Marek Halloran",
    cast: ["Nadia Reyes", "Idris Kane"],
    ...overrides,
  };
}

function makeTVShow(overrides: Partial<TVShow> = {}): TVShow {
  return {
    id: "t1",
    slug: "northlight",
    kind: "tv",
    title: "Northlight",
    synopsis: "An ensemble mystery.",
    year: 2021,
    posterUrl: "/media/posters/northlight.svg",
    genres: ["Mystery"],
    seasons: 3,
    episodes: 24,
    creators: ["Lena Voss"],
    status: "ended",
    ...overrides,
  };
}

function makeBook(overrides: Partial<Book> = {}): Book {
  return {
    id: "b1",
    slug: "field-guide",
    kind: "book",
    title: "Field Guide",
    synopsis: "A naturalist's notebook.",
    year: 2019,
    posterUrl: "/media/posters/fieldguide.svg",
    genres: ["Nonfiction"],
    authors: ["Devon Halle"],
    pageCount: 274,
    ...overrides,
  };
}

describe("CANONICAL_DOCUMENT_VERSION", () => {
  it("is the documented v1 format tag", () => {
    expect(CANONICAL_DOCUMENT_VERSION).toBe("v1");
  });
});

describe("buildCanonicalDocument", () => {
  it("renders movie fields in the stable order with a movie Kind label", () => {
    const document = buildCanonicalDocument(
      makeMovie({ subtitle: "Original Title" }),
    );
    expect(document.split("\n")).toEqual([
      "Title: Afterglow",
      "Subtitle: Original Title",
      "Kind: Movie",
      "Year: 2023",
      "Genres: Drama",
      "Director: Marek Halloran",
      "Cast: Nadia Reyes, Idris Kane",
      "Synopsis: A quiet drama.",
    ]);
  });

  it("uses the TV series Kind label and Creators credit", () => {
    const document = buildCanonicalDocument(makeTVShow());
    expect(document).toContain("Kind: TV series");
    expect(document).toContain("Creators: Lena Voss");
  });

  it("uses the Book Kind label, Authors, and optional Publisher", () => {
    const withPublisher = buildCanonicalDocument(
      makeBook({ publisher: "Northwind Press" }),
    );
    expect(withPublisher).toContain("Kind: Book");
    expect(withPublisher).toContain("Authors: Devon Halle");
    expect(withPublisher).toContain("Publisher: Northwind Press");

    const withoutPublisher = buildCanonicalDocument(makeBook());
    expect(withoutPublisher).not.toContain("Publisher:");
  });

  it("omits a missing subtitle", () => {
    const document = buildCanonicalDocument(makeMovie());
    expect(document).not.toContain("Subtitle:");
  });

  it("omits empty credit arrays, empty genres, and blank synopsis", () => {
    const document = buildCanonicalDocument(
      makeMovie({
        genres: [],
        director: "",
        cast: [],
        synopsis: "   ",
      }),
    );
    expect(document).not.toContain("Genres:");
    expect(document).not.toContain("Director:");
    expect(document).not.toContain("Cast:");
    expect(document).not.toContain("Synopsis:");
    expect(document.split("\n")).toEqual([
      "Title: Afterglow",
      "Kind: Movie",
      "Year: 2023",
    ]);
  });

  it("collapses whitespace runs and trims values", () => {
    const document = buildCanonicalDocument(
      makeMovie({
        title: "  After   glow  ",
        synopsis: "line one\n\n   line two",
      }),
    );
    expect(document).toContain("Title: After glow");
    expect(document).toContain("Synopsis: line one line two");
  });

  it("de-duplicates list values while preserving first-seen order", () => {
    const document = buildCanonicalDocument(
      makeMovie({
        genres: ["Drama", "Thriller", "Drama", "  Drama  "],
        cast: ["Nadia Reyes", "Idris Kane", "Nadia Reyes"],
      }),
    );
    expect(document).toContain("Genres: Drama, Thriller");
    expect(document).toContain("Cast: Nadia Reyes, Idris Kane");
  });
});

describe("hashCanonicalDocument", () => {
  it("returns a 64-character lowercase hex digest", () => {
    const hash = hashCanonicalDocument(buildCanonicalDocument(makeMovie()));
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("is stable for identical input", () => {
    const document = buildCanonicalDocument(makeMovie());
    expect(hashCanonicalDocument(document)).toBe(
      hashCanonicalDocument(document),
    );
  });

  it("differs when the document text differs", () => {
    const a = hashCanonicalDocument("Title: A");
    const b = hashCanonicalDocument("Title: B");
    expect(a).not.toBe(b);
  });
});

describe("canonicalDocumentFor", () => {
  it("returns a document and contentHash consistent with the primitives", () => {
    const movie = makeMovie();
    const { document, contentHash } = canonicalDocumentFor(movie);
    expect(document).toBe(buildCanonicalDocument(movie));
    expect(contentHash).toBe(hashCanonicalDocument(document));
  });

  it("invalidates the hash when a genre changes", () => {
    const before = canonicalDocumentFor(makeMovie({ genres: ["Drama"] }));
    const after = canonicalDocumentFor(makeMovie({ genres: ["Comedy"] }));
    expect(after.contentHash).not.toBe(before.contentHash);
  });

  it("invalidates the hash when the synopsis changes", () => {
    const before = canonicalDocumentFor(makeMovie({ synopsis: "First." }));
    const after = canonicalDocumentFor(makeMovie({ synopsis: "Second." }));
    expect(after.contentHash).not.toBe(before.contentHash);
  });
});
