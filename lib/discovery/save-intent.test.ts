import { describe, expect, it } from "vitest";
import { getSafeRedirectPath } from "@/lib/auth/safe-redirect";
import {
  saveIntentKey,
  withSaveIntent,
  withoutSaveIntent,
} from "./save-intent";

const ref = { provider: "tmdb", kind: "movie", externalId: "693134" } as const;

describe("save intent", () => {
  it("builds a stable key from the provider identity", () => {
    expect(saveIntentKey(ref)).toBe("tmdb:movie:693134");
  });

  it("adds the intent to a bare path", () => {
    expect(withSaveIntent("/", ref)).toBe("/?save=tmdb%3Amovie%3A693134");
  });

  it("keeps existing query params and the hash, replacing any old intent", () => {
    expect(
      withSaveIntent("/explore?type=game&save=old#discover", {
        provider: "rawg",
        kind: "game",
        externalId: "3498",
      }),
    ).toBe("/explore?type=game&save=rawg%3Agame%3A3498#discover");
  });

  it("stays a safe same-origin redirect target", () => {
    const target = withSaveIntent("/explore?type=movie", ref);
    expect(getSafeRedirectPath(target, "/")).toBe(target);
  });

  it("strips only the intent from a query", () => {
    expect(withoutSaveIntent("?type=tv&save=tmdb%3Atv%3A1")).toBe("?type=tv");
    expect(withoutSaveIntent("?save=x")).toBe("");
  });
});
