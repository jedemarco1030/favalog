import { describe, expect, it } from "vitest";

import { parseMaterializeFormData } from "./materialize-form";

function form(entries: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(entries)) fd.set(k, v);
  return fd;
}

describe("parseMaterializeFormData", () => {
  it("reads only the allow-listed identity triplet", () => {
    const fd = form({
      provider: "tmdb",
      kind: "movie",
      externalId: "693134",
      // Hostile extra fields that must be ignored by the parser.
      title: "Fake Title",
      slug: "fake-slug",
      year: "1900",
      averageRating: "5",
      userId: "attacker",
    });
    expect(parseMaterializeFormData(fd)).toEqual({
      provider: "tmdb",
      kind: "movie",
      externalId: "693134",
    });
  });

  it("defaults missing fields to empty strings (server validates)", () => {
    expect(parseMaterializeFormData(form({}))).toEqual({
      provider: "",
      kind: "",
      externalId: "",
    });
  });

  it("never reads title/slug/year/rating from the form", () => {
    const result = parseMaterializeFormData(
      form({ provider: "openlibrary", kind: "book", externalId: "OL45804W" }),
    );
    expect(result).not.toHaveProperty("title");
    expect(result).not.toHaveProperty("slug");
    expect(result).not.toHaveProperty("year");
  });
});
