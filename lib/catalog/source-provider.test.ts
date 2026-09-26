import { describe, expect, it } from "vitest";
import { providerFromSource } from "./source-provider";

describe("providerFromSource", () => {
  it.each(["tmdb", "openlibrary", "rawg"] as const)(
    "maps the %s source to its provider",
    (source) => {
      expect(providerFromSource(source)).toBe(source);
    },
  );

  it("returns null for curated Favalog rows", () => {
    expect(providerFromSource("favalog")).toBeNull();
  });

  it.each([["igdb"], ["TMDB"], [""], [null], [undefined], [42]])(
    "returns null for an unrecognized source %p",
    (source) => {
      expect(providerFromSource(source)).toBeNull();
    },
  );
});
