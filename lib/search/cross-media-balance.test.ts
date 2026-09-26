import { describe, expect, it } from "vitest";

import type { MediaKind } from "@/lib/types";
import {
  balanceAcrossKinds,
  lexicalTier,
  normalizeTitleForMatch,
} from "./cross-media-balance";
import { fuseByRrf, promoteExactTitles } from "./rrf";

interface FixtureItem {
  id: string;
  kind: MediaKind;
  title: string;
  creator: string;
}

const item = (
  id: string,
  kind: MediaKind,
  title: string,
  creator: string,
): FixtureItem => ({ id, kind, title, creator });

describe("normalizeTitleForMatch / lexicalTier", () => {
  it("ignores case, punctuation, diacritics, and a leading article", () => {
    expect(normalizeTitleForMatch("The Odyssey")).toBe("odyssey");
    expect(normalizeTitleForMatch("Assassin's Creed: Odyssey")).toBe(
      "assassins creed odyssey",
    );
    expect(normalizeTitleForMatch("Pokémon")).toBe("pokemon");
  });

  it("classifies exact, whole-word, and other matches", () => {
    expect(lexicalTier("The Odyssey", "odyssey")).toBe(0);
    expect(lexicalTier("Super Mario Odyssey", "odyssey")).toBe(1);
    expect(lexicalTier("Odysseus Returns", "odyssey")).toBe(2);
    expect(lexicalTier("Anything", "   ")).toBe(2);
  });
});

/**
 * Deterministic "odyssey" fixture. The input order simulates a database
 * ranking in which book rows crowd the top slots. Nothing in the implementation
 * knows about these titles; the same rules apply to any query.
 */
const ODYSSEY_RANKED: FixtureItem[] = [
  item("b1", "book", "The Odyssey", "Homer"),
  item("b2", "book", "The Odyssey: A Reader's Companion", "J. Scholar"),
  item("b3", "book", "An Odyssey of Letters", "M. Writer"),
  item("m1", "movie", "The Odyssey", "Christopher Nolan"),
  item("b4", "book", "Odyssey Notes", "S. Student"),
  item("b5", "book", "Odysseus and Sons", "T. Author"),
  item("t1", "tv", "Odyssey Diaries", "P. Showrunner"),
  item("g1", "game", "Assassin's Creed Odyssey", "Ubisoft Quebec"),
  item("g2", "game", "Super Mario Odyssey", "Nintendo EPD"),
  item("m2", "movie", "2001: A Space Odyssey", "Stanley Kubrick"),
];

describe("balanceAcrossKinds — odyssey fixture", () => {
  const balanced = balanceAcrossKinds(ODYSSEY_RANKED, "odyssey");

  it("keeps exact-title matches first, disambiguated by creator and kind", () => {
    expect(balanced.slice(0, 2).map((r) => [r.kind, r.creator])).toEqual([
      ["book", "Homer"],
      ["movie", "Christopher Nolan"],
    ]);
  });

  it("moves both games up from behind the book-heavy ranking", () => {
    const ids = balanced.map((r) => r.id);
    const before = ODYSSEY_RANKED.map((r) => r.id);
    expect(ids.indexOf("g1")).toBeLessThan(before.indexOf("g1"));
    expect(ids.indexOf("g2")).toBeLessThan(before.indexOf("g2"));
    expect(ids.slice(0, 5)).toContain("g1");
  });

  it("does not let one kind fill the strong-match window", () => {
    const strong = balanced.slice(2, 6).map((r) => r.kind);
    expect(new Set(strong).size).toBeGreaterThanOrEqual(3);
  });

  it("preserves each kind's internal rank order", () => {
    const books = balanced.filter((r) => r.kind === "book").map((r) => r.id);
    expect(books).toEqual(["b1", "b2", "b3", "b4", "b5"]);
  });

  it("is a permutation of the input (nothing dropped or invented)", () => {
    expect([...balanced].map((r) => r.id).sort()).toEqual(
      ODYSSEY_RANKED.map((r) => r.id).sort(),
    );
  });

  it("applies the same rules to an unrelated query", () => {
    const ranked = [
      item("x1", "movie", "Dune", "Denis Villeneuve"),
      item("x2", "movie", "Dune: Part Two", "Denis Villeneuve"),
      item("x3", "movie", "Dune Drifter", "Someone"),
      item("x4", "book", "Dune", "Frank Herbert"),
      item("x5", "game", "Dune: Spice Wars", "Shiro Games"),
    ];
    expect(balanceAcrossKinds(ranked, "dune").map((r) => r.id)).toEqual([
      "x1",
      "x4",
      "x2",
      "x5",
      "x3",
    ]);
  });
});

/**
 * Cross-media semantic retrieval over a synthetic embedding space. Concept axes
 * stand in for a real model; no live provider or OpenAI credential is used.
 */
const AXES = ["journey", "ancient", "myth", "space", "crime", "romance"];

const SEMANTIC_CORPUS: Array<FixtureItem & { vector: number[] }> = [
  {
    ...item("s-book", "book", "The Odyssey", "Homer"),
    vector: [1, 1, 1, 0, 0, 0.1],
  },
  {
    ...item("s-game", "game", "Assassin's Creed Odyssey", "Ubisoft Quebec"),
    vector: [0.9, 1, 0.8, 0, 0.1, 0],
  },
  {
    ...item("s-movie", "movie", "Troy", "Wolfgang Petersen"),
    vector: [0.6, 1, 0.9, 0, 0, 0.4],
  },
  {
    ...item("s-tv", "tv", "Rome", "HBO"),
    vector: [0.5, 1, 0.3, 0, 0.3, 0.2],
  },
  {
    ...item("s-noir", "movie", "Night City Heist", "A. Director"),
    vector: [0, 0, 0, 0.1, 1, 0.2],
  },
  {
    ...item("s-space", "book", "Stars Between Us", "B. Author"),
    vector: [0.4, 0, 0, 1, 0, 0.6],
  },
];

const QUERY_TERMS: Record<string, string> = {
  journeys: "journey",
  journey: "journey",
  epic: "myth",
  ancient: "ancient",
  worlds: "ancient",
};

function syntheticQueryVector(query: string): number[] {
  const vector = AXES.map(() => 0);
  for (const word of query.toLowerCase().split(/\W+/)) {
    const axis = QUERY_TERMS[word];
    if (axis) vector[AXES.indexOf(axis)] += 1;
  }
  return vector;
}

function cosine(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
}

function hybridSearch(query: string, keywordIds: string[]) {
  const qv = syntheticQueryVector(query);
  const semanticIds = SEMANTIC_CORPUS.map((r) => ({
    id: r.id,
    s: cosine(qv, r.vector),
  }))
    .filter((r) => r.s > 0.3)
    .sort((a, b) => b.s - a.s)
    .map((r) => r.id);
  const exact = SEMANTIC_CORPUS.filter(
    (r) => lexicalTier(r.title, query) === 0,
  ).map((r) => r.id);
  const fused = promoteExactTitles(fuseByRrf([keywordIds, semanticIds]), exact);
  const byId = new Map(SEMANTIC_CORPUS.map((r) => [r.id, r]));
  const ranked = fused
    .map((f) => byId.get(f.id))
    .filter((r) => r !== undefined);
  return balanceAcrossKinds(ranked, query);
}

describe("cross-media semantic fixture retrieval", () => {
  it("retrieves all four media kinds for a thematic query", () => {
    const results = hybridSearch("epic journeys through ancient worlds", []);
    const top = results.slice(0, 4);
    expect(new Set(top.map((r) => r.kind))).toEqual(
      new Set(["book", "game", "movie", "tv"]),
    );
    expect(results.map((r) => r.id)).not.toContain("s-noir");
  });

  it("keeps exact-title protection ahead of thematic neighbours", () => {
    const results = hybridSearch("The Odyssey", ["s-game", "s-book"]);
    expect(results[0].id).toBe("s-book");
  });
});
