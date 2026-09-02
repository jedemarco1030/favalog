import { describe, expect, it } from "vitest";

import { MAX_GENRES } from "../config";
import { CANONICAL_BOOK_GENRES, canonicalizeBookGenres } from "./genres";

describe("canonicalizeBookGenres", () => {
  it("maps clean canonical subjects through unchanged", () => {
    expect(canonicalizeBookGenres(["Science Fiction", "Fiction"])).toEqual([
      "Science Fiction",
      "Fiction",
    ]);
  });

  it("is case- and whitespace-insensitive", () => {
    expect(canonicalizeBookGenres(["  science   FICTION ", "fAntAsy"])).toEqual(
      ["Science Fiction", "Fantasy"],
    );
  });

  it("maps known aliases to one canonical value", () => {
    expect(canonicalizeBookGenres(["Sci-Fi"])).toEqual(["Science Fiction"]);
    expect(canonicalizeBookGenres(["Science-fiction"])).toEqual([
      "Science Fiction",
    ]);
    expect(canonicalizeBookGenres(["scifi"])).toEqual(["Science Fiction"]);
    expect(canonicalizeBookGenres(["non-fiction"])).toEqual(["Nonfiction"]);
    expect(canonicalizeBookGenres(["memoirs"])).toEqual(["Memoir"]);
    expect(canonicalizeBookGenres(["juvenile fiction"])).toEqual([
      "Children's",
    ]);
  });

  it("resolves a comma-composite subject to the most specific genre", () => {
    expect(
      canonicalizeBookGenres(["Fiction, science fiction, general"]),
    ).toEqual(["Science Fiction"]);
  });

  it("keeps a real genre token while ignoring an entity token", () => {
    // "Dune (imaginary place)" is an entity; "fiction" is a real genre.
    expect(canonicalizeBookGenres(["Dune (imaginary place), fiction"])).toEqual(
      ["Fiction"],
    );
  });

  it("dedupes across subjects, preserving first-seen order", () => {
    expect(
      canonicalizeBookGenres([
        "Science Fiction",
        "sci-fi",
        "Fantasy",
        "SCIENCE FICTION",
      ]),
    ).toEqual(["Science Fiction", "Fantasy"]);
  });

  describe("fail-closed rejection", () => {
    it("rejects award metadata", () => {
      expect(canonicalizeBookGenres(["award:nebula_award=novel"])).toEqual([]);
    });

    it("rejects bestseller / list metadata with provider syntax + dates", () => {
      expect(
        canonicalizeBookGenres(["nyt:mass-market-monthly=2021-11-07"]),
      ).toEqual([]);
    });

    it("rejects a bare place / entity", () => {
      expect(canonicalizeBookGenres(["Dune (Imaginary place)"])).toEqual([]);
      expect(canonicalizeBookGenres(["Middle-earth"])).toEqual([]);
    });

    it("rejects subjects containing digits (dates, years, identifiers)", () => {
      expect(canonicalizeBookGenres(["Fiction 2021"])).toEqual([]);
      expect(canonicalizeBookGenres(["2020s"])).toEqual([]);
    });

    it("rejects provider query syntax", () => {
      expect(canonicalizeBookGenres(["subject=fiction"])).toEqual([]);
      expect(canonicalizeBookGenres(["lists:foo"])).toEqual([]);
    });

    it("rejects unknown general cataloguing prose", () => {
      expect(
        canonicalizeBookGenres([
          "Accessible book",
          "Protected DAISY",
          "In library",
          "general",
        ]),
      ).toEqual([]);
    });
  });

  it("degrades non-array / non-string input to an empty list", () => {
    expect(canonicalizeBookGenres(undefined)).toEqual([]);
    expect(canonicalizeBookGenres(null)).toEqual([]);
    expect(canonicalizeBookGenres("Fiction")).toEqual([]);
    expect(canonicalizeBookGenres([123, {}, null, "Fantasy"])).toEqual([
      "Fantasy",
    ]);
  });

  it("caps the number of returned genres at MAX_GENRES", () => {
    const many = CANONICAL_BOOK_GENRES.flatMap((g) => [g, g]);
    expect(canonicalizeBookGenres(many).length).toBe(
      Math.min(MAX_GENRES, CANONICAL_BOOK_GENRES.length),
    );
  });

  it("only ever emits values from the closed taxonomy", () => {
    const allowed = new Set<string>(CANONICAL_BOOK_GENRES);
    const result = canonicalizeBookGenres([
      "Science Fiction",
      "Dune (Imaginary place)",
      "award:x=y",
      "Fantasy",
      "Totally Made Up Genre",
    ]);
    for (const genre of result) expect(allowed.has(genre)).toBe(true);
  });
});
