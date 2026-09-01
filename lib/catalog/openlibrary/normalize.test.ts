import { describe, expect, it } from "vitest";

import { MAX_AUTHORS } from "../config";
import {
  authorKeysFromWork,
  descriptionText,
  normalizeOpenLibrarySearchDoc,
  normalizeOpenLibraryWork,
} from "./normalize";
import type { OpenLibrarySearchDoc, OpenLibraryWork } from "./types";

function work(overrides: Partial<OpenLibraryWork> = {}): OpenLibraryWork {
  return {
    key: "/works/OL123W",
    title: "Fantastic Mr Fox",
    subtitle: undefined,
    description: "A clever fox outwits three farmers.",
    subjects: ["Children", "Fiction"],
    covers: [456, 789],
    first_publish_date: "1970",
    authors: [{ author: { key: "/authors/OL34184A" } }],
    ...overrides,
  };
}

describe("descriptionText", () => {
  it("returns a cleaned string description", () => {
    expect(descriptionText("  a  clever   fox ")).toBe("a clever fox");
  });

  it("reads the `.value` of an object description", () => {
    expect(descriptionText({ value: "outwits three farmers" })).toBe(
      "outwits three farmers",
    );
  });

  it("returns '' for a missing / undefined description", () => {
    expect(descriptionText(undefined)).toBe("");
    expect(descriptionText({})).toBe("");
  });
});

describe("normalizeOpenLibraryWork", () => {
  it("maps the Work id from the key, plus title, genres, year, and cover", () => {
    const item = normalizeOpenLibraryWork(work(), ["Roald Dahl"]);
    expect(item.kind).toBe("book");
    expect(item.ref).toEqual({
      provider: "openlibrary",
      kind: "book",
      externalId: "OL123W",
    });
    expect(item.title).toBe("Fantastic Mr Fox");
    expect(item.genres).toEqual(["Children", "Fiction"]);
    expect(item.year).toBe(1970);
    expect(item.posterUrl).toBe(
      "https://covers.openlibrary.org/b/id/456-L.jpg",
    );
  });

  it("caps and de-dupes the passed-in author names", () => {
    const many = Array.from(
      { length: MAX_AUTHORS + 4 },
      (_, i) => `Author ${i}`,
    );
    const item = normalizeOpenLibraryWork(work(), [...many, "Author 0"]);
    if (item.kind !== "book") throw new Error("expected a book");
    expect(item.authors).toHaveLength(MAX_AUTHORS);
    // De-dupe: "Author 0" appears once even though it was passed twice.
    expect(item.authors.filter((a) => a === "Author 0")).toHaveLength(1);
  });

  it("degrades a missing cover to an undefined posterUrl", () => {
    const item = normalizeOpenLibraryWork(work({ covers: undefined }), []);
    expect(item.posterUrl).toBeUndefined();
  });

  it("degrades a missing description to '' synopsis", () => {
    const item = normalizeOpenLibraryWork(work({ description: undefined }), []);
    expect(item.synopsis).toBe("");
  });

  it("uses year 0 when first_publish_date is missing", () => {
    const item = normalizeOpenLibraryWork(
      work({ first_publish_date: undefined }),
      [],
    );
    expect(item.year).toBe(0);
  });

  it("uses a trusted fallback year when the Work lacks a date", () => {
    const item = normalizeOpenLibraryWork(
      work({ first_publish_date: undefined }),
      [],
      1965,
    );
    expect(item.year).toBe(1965);
  });

  it("prefers the Work's own date over any fallback year", () => {
    const item = normalizeOpenLibraryWork(
      work({ first_publish_date: "1954" }),
      [],
      1965,
    );
    expect(item.year).toBe(1954);
  });

  it("rejects an out-of-bounds fallback year (stays 0)", () => {
    const item = normalizeOpenLibraryWork(
      work({ first_publish_date: undefined }),
      [],
      1400,
    );
    expect(item.year).toBe(0);
  });

  it("always reports pageCount 0 for a Work", () => {
    const item = normalizeOpenLibraryWork(work(), []);
    if (item.kind !== "book") throw new Error("expected a book");
    expect(item.pageCount).toBe(0);
  });
});

describe("normalizeOpenLibrarySearchDoc", () => {
  it("maps year and cover and returns a book candidate", () => {
    const doc: OpenLibrarySearchDoc = {
      key: "/works/OL123W",
      title: "Fantastic Mr Fox",
      first_publish_year: 1970,
      cover_i: 456,
    };
    const candidate = normalizeOpenLibrarySearchDoc(doc);
    expect(candidate).not.toBeNull();
    expect(candidate?.kind).toBe("book");
    expect(candidate?.ref.externalId).toBe("OL123W");
    expect(candidate?.year).toBe(1970);
    expect(candidate?.posterUrl).toBe(
      "https://covers.openlibrary.org/b/id/456-L.jpg",
    );
  });

  it("returns null without a resolvable Work id", () => {
    expect(
      normalizeOpenLibrarySearchDoc({ key: "/works/bad", title: "X" }),
    ).toBeNull();
    expect(normalizeOpenLibrarySearchDoc({ title: "No Key" })).toBeNull();
  });

  it("returns null without a title", () => {
    expect(normalizeOpenLibrarySearchDoc({ key: "/works/OL123W" })).toBeNull();
  });
});

describe("authorKeysFromWork", () => {
  it("extracts well-formed author keys", () => {
    const keys = authorKeysFromWork(
      work({
        authors: [
          { author: { key: "/authors/OL1A" } },
          { author: { key: "/authors/OL2A" } },
        ],
      }),
    );
    expect(keys).toEqual(["/authors/OL1A", "/authors/OL2A"]);
  });

  it("ignores malformed author keys", () => {
    const keys = authorKeysFromWork(
      work({
        authors: [
          { author: { key: "/authors/OL1A" } },
          { author: { key: "/authors/broken" } },
          { author: { key: "OL2A" } },
          { author: {} },
          {},
        ],
      }),
    );
    expect(keys).toEqual(["/authors/OL1A"]);
  });

  it("caps the number of author keys at MAX_AUTHORS", () => {
    const authors = Array.from({ length: MAX_AUTHORS + 5 }, (_, i) => ({
      author: { key: `/authors/OL${i + 1}A` },
    }));
    expect(authorKeysFromWork(work({ authors }))).toHaveLength(MAX_AUTHORS);
  });

  it("returns [] when there are no authors", () => {
    expect(authorKeysFromWork(work({ authors: undefined }))).toEqual([]);
  });
});
