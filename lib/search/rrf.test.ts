import { describe, expect, it } from "vitest";

import { RRF_K } from "@/lib/search/config";
import { fuseByRrf, promoteExactTitles, rrfScores } from "@/lib/search/rrf";

describe("rrfScores", () => {
  it("uses the 1/(k+rank) formula with 1-based ranks", () => {
    const scores = rrfScores([["a", "b"]], 10);
    expect(scores.get("a")).toBeCloseTo(1 / 11, 12);
    expect(scores.get("b")).toBeCloseTo(1 / 12, 12);
  });

  it("sums an id's contribution across multiple lists", () => {
    const scores = rrfScores(
      [
        ["a", "b"],
        ["b", "a"],
      ],
      10,
    );
    expect(scores.get("a")).toBeCloseTo(1 / 11 + 1 / 12, 12);
    expect(scores.get("b")).toBeCloseTo(1 / 12 + 1 / 11, 12);
  });

  it("defaults k to RRF_K", () => {
    const scores = rrfScores([["a"]]);
    expect(scores.get("a")).toBeCloseTo(1 / (RRF_K + 1), 12);
  });
});

describe("fuseByRrf", () => {
  it("orders by descending fused score", () => {
    const fused = fuseByRrf([
      ["a", "b", "c"],
      ["a", "c"],
    ]);
    expect(fused.map((entry) => entry.id)).toEqual(["a", "c", "b"]);
  });

  it("ranks an item appearing in both lists above one in a single list", () => {
    const fused = fuseByRrf([
      ["x", "shared"],
      ["y", "shared"],
    ]);
    expect(fused[0].id).toBe("shared");
  });

  it("breaks ties by earliest first appearance across the lists", () => {
    // "a" and "b" both appear once at rank 1, so their scores tie.
    const fused = fuseByRrf([["a"], ["b"]]);
    expect(fused.map((entry) => entry.id)).toEqual(["a", "b"]);
  });
});

describe("promoteExactTitles", () => {
  it("returns an unchanged copy when there are no exact ids", () => {
    const fused = [
      { id: "a", score: 3 },
      { id: "b", score: 2 },
    ];
    const result = promoteExactTitles(fused, []);
    expect(result).toEqual(fused);
    expect(result).not.toBe(fused);
  });

  it("promotes matching ids to the front, preserving fused order", () => {
    const fused = [
      { id: "a", score: 3 },
      { id: "b", score: 2 },
      { id: "c", score: 1 },
    ];
    const result = promoteExactTitles(fused, ["c", "b"]);
    // b precedes c in the fused list, so their relative order is preserved.
    expect(result.map((entry) => entry.id)).toEqual(["b", "c", "a"]);
  });

  it("prepends exact ids absent from the fused pool, in the given order", () => {
    const fused = [{ id: "a", score: 3 }];
    const result = promoteExactTitles(fused, ["x", "y"]);
    expect(result.map((entry) => entry.id)).toEqual(["x", "y", "a"]);
    expect(result[0].score).toBe(Number.POSITIVE_INFINITY);
    expect(result[1].score).toBe(Number.POSITIVE_INFINITY);
  });

  it("places missing exact ids ahead of present promoted ids", () => {
    const fused = [
      { id: "a", score: 3 },
      { id: "b", score: 2 },
    ];
    const result = promoteExactTitles(fused, ["missing", "b"]);
    expect(result.map((entry) => entry.id)).toEqual(["missing", "b", "a"]);
  });
});
