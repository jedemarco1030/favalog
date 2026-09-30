import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  LEGACY_DEMONSTRATION_IDS,
  PRODUCTION_CATALOG_FILTER,
  isDemonstrationIdentity,
} from "./demonstration";

describe("legacy demonstration identity", () => {
  it.each(LEGACY_DEMONSTRATION_IDS)(
    "classifies only the exact favalog identity %s",
    (id) => {
      expect(isDemonstrationIdentity("favalog", id)).toBe(true);
      expect(isDemonstrationIdentity("tmdb", id)).toBe(false);
      expect(isDemonstrationIdentity("favalog", `${id}-real`)).toBe(false);
    },
  );

  it("preserves legitimate internal titles and name-independent provider identities", () => {
    expect(isDemonstrationIdentity("favalog", "curated-arrival")).toBe(false);
    expect(isDemonstrationIdentity("tmdb", "movie:693134")).toBe(false);
    expect(isDemonstrationIdentity("favalog", "")).toBe(false);
  });

  it("keeps SQL retrieval and pre-pagination PostgREST filters on exactly the same identities", () => {
    const migration = readFileSync(
      "supabase/migrations/20260930180000_separate_demonstration_catalog.sql",
      "utf8",
    );
    const ids = migration
      .match(/\$ids\$([^$]+)\$ids\$/)?.[1]
      .replaceAll("'", "")
      .split(",");
    expect(ids).toEqual([...LEGACY_DEMONSTRATION_IDS]);
    expect(PRODUCTION_CATALOG_FILTER).toBe(
      `source.neq.favalog,external_id.not.in.(${ids?.join(",")})`,
    );
  });
});
