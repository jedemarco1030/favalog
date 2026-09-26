import { describe, expect, it } from "vitest";

import { rawgIdToExternalId, rawgImageUrl } from "./config";
import { normalizeRawgGame, normalizeRawgSearchResult } from "./normalize";
import detail from "./__fixtures__/game-detail.json";
import tba from "./__fixtures__/game-detail-tba.json";
import search from "./__fixtures__/search.json";

describe("rawgImageUrl", () => {
  it("accepts only https media.rawg.io /media/ paths", () => {
    expect(rawgImageUrl("https://media.rawg.io/media/games/a/b.jpg")).toBe(
      "https://media.rawg.io/media/games/a/b.jpg",
    );
    expect(rawgImageUrl("http://media.rawg.io/media/games/a/b.jpg")).toBe(
      undefined,
    );
    expect(rawgImageUrl("https://evil.example.com/media/x.jpg")).toBe(
      undefined,
    );
    expect(rawgImageUrl("https://media.rawg.io/other/x.jpg")).toBe(undefined);
    expect(rawgImageUrl("not a url")).toBe(undefined);
    expect(rawgImageUrl(null)).toBe(undefined);
  });

  it("drops query strings and fragments from accepted URLs", () => {
    expect(rawgImageUrl("https://media.rawg.io/media/g/x.jpg?track=1#f")).toBe(
      "https://media.rawg.io/media/g/x.jpg",
    );
  });
});

describe("rawgIdToExternalId", () => {
  it("accepts only positive integers", () => {
    expect(rawgIdToExternalId(3328)).toBe("3328");
    expect(rawgIdToExternalId(0)).toBe(undefined);
    expect(rawgIdToExternalId(-1)).toBe(undefined);
    expect(rawgIdToExternalId(1.5)).toBe(undefined);
    expect(rawgIdToExternalId("3328")).toBe(undefined);
  });
});

describe("normalizeRawgGame", () => {
  it("maps a full detail record into a bounded game item", () => {
    const item = normalizeRawgGame(detail);
    expect(item.kind).toBe("game");
    expect(item.ref).toEqual({
      provider: "rawg",
      kind: "game",
      externalId: "3328",
    });
    expect(item.title).toBe("The Witcher 3: Wild Hunt");
    expect(item.subtitle).toBe("Wiedźmin 3: Dziki Gon");
    expect(item.synopsis).toBe(
      "The third game in a series, it holds nothing back from the player.",
    );
    expect(item.year).toBe(2015);
    expect(item.genres).toEqual(["Action", "RPG"]);
    expect(item.averageRating).toBe(4.65);
    expect(item.posterUrl).toMatch(/^https:\/\/media\.rawg\.io\/media\/games/);
    expect(item.backdropUrl).toMatch(/\/media\/screenshots\//);
    if (item.kind !== "game") throw new Error("expected game");
    expect(item.platforms).toEqual(["PC", "PlayStation 4", "Nintendo Switch"]);
    expect(item.developers).toEqual(["CD PROJEKT RED"]);
    expect(item.publishers).toEqual([
      "CD PROJEKT RED",
      "Warner Bros. Interactive",
    ]);
  });

  it("does not trust a release year for a TBA game and drops bad artwork", () => {
    const item = normalizeRawgGame(tba);
    expect(item.year).toBe(0);
    expect(item.posterUrl).toBeUndefined();
    expect(item.backdropUrl).toBeUndefined();
    expect(item.averageRating).toBeUndefined();
    expect(item.subtitle).toBeUndefined();
    if (item.kind !== "game") throw new Error("expected game");
    expect(item.platforms).toEqual([]);
    expect(item.developers).toEqual([]);
  });

  it("omits an original name equal to the display title", () => {
    const item = normalizeRawgGame({ ...detail, name_original: detail.name });
    expect(item.subtitle).toBeUndefined();
  });
});

describe("normalizeRawgSearchResult", () => {
  it("skips rows without an id and strips unsafe images", () => {
    const candidates = search.results
      .map(normalizeRawgSearchResult)
      .filter((c) => c !== null);
    expect(candidates.map((c) => c.ref.externalId)).toEqual([
      "3328",
      "10035",
      "777001",
    ]);
    expect(candidates[1].posterUrl).toBeUndefined();
    expect(candidates[2].year).toBeUndefined();
    expect(candidates.every((c) => c.kind === "game")).toBe(true);
  });
});
