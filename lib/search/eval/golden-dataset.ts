/**
 * Human-reviewed golden dataset for catalog-retrieval evaluation.
 *
 * Cases are authored against the stable curated catalog (28 titles) and span
 * exact-title, genre, theme, mood, person, cross-media, and negative intents —
 * deliberately including queries that are hard for pure keyword matching (e.g.
 * the TV "Sci-Fi" genre label vs. a "science fiction" query) so the harness can
 * surface ranking failures rather than only prove the happy path.
 *
 * `relevantSlugs` is the set of ACCEPTABLE catalog slugs for a query; a negative
 * case has an empty set (nothing should confidently match). Only stable slugs
 * from the catalog migrations are referenced.
 */

import type { EvalThresholds, GoldenCase } from "./metrics";

export const GOLDEN_CASES: GoldenCase[] = [
  // --- Exact-title (must not be demoted by semantic neighbours) -------------
  {
    id: "exact-dune",
    query: "Dune: Part Two",
    relevantSlugs: ["dune-part-two"],
    rationale: "A direct, punctuated title query must return that exact film.",
    tags: ["exact-title", "person"],
  },
  {
    id: "exact-northlight",
    query: "Northlight",
    relevantSlugs: ["northlight"],
    rationale: "Single-word exact title.",
    tags: ["exact-title"],
  },
  {
    id: "exact-seas-of-glass",
    query: "Seas of Glass",
    relevantSlugs: ["seas-of-glass"],
    rationale: "Exact book title with common words.",
    tags: ["exact-title"],
  },
  {
    id: "exact-quiet-signal-lower",
    query: "quiet signal",
    relevantSlugs: ["quiet-signal"],
    rationale: "Lower-cased exact title should still win top-1.",
    tags: ["exact-title"],
  },
  // --- Theme -----------------------------------------------------------------
  {
    id: "theme-memory-grief",
    query: "a thoughtful science fiction story about memory and grief",
    relevantSlugs: ["orbital-notes", "seas-of-glass", "arc-lighthouse"],
    rationale:
      "Reflective titles touching memory/loss; the canonical example query.",
    tags: ["theme", "mood", "cross-media"],
  },
  {
    id: "theme-maps",
    query: "maps and cartography",
    relevantSlugs: [
      "paper-lantern",
      "the-cartographer",
      "orbital-notes",
      "seas-of-glass",
    ],
    rationale: "Titles centred on maps/cartographers across kinds.",
    tags: ["theme", "cross-media"],
  },
  {
    id: "theme-radio-signals",
    query: "mysterious radio signals and messages",
    relevantSlugs: ["signal-glass", "the-slow-dial", "quiet-signal"],
    rationale: "Radio/signal/message motifs across TV, book, and film.",
    tags: ["theme", "cross-media"],
  },
  {
    id: "theme-ferry",
    query: "ferries and overnight coastal crossings",
    relevantSlugs: ["night-ferry", "harbour-lines"],
    rationale: "Ferry/crossing motif.",
    tags: ["theme", "cross-media"],
  },
  {
    id: "theme-lighthouse",
    query: "a lighthouse and something offshore",
    relevantSlugs: ["arc-lighthouse"],
    rationale: "Distinctive lighthouse premise.",
    tags: ["theme"],
  },
  {
    id: "theme-translator",
    query: "a quiet literary novel about a translator",
    relevantSlugs: ["the-small-hours", "the-north-room"],
    rationale: "Two literary novels featuring translators.",
    tags: ["theme", "mood"],
    kind: "book",
  },
  {
    id: "theme-archives",
    query: "archives and libraries",
    relevantSlugs: ["the-bright-index", "signal-glass"],
    rationale: "Archive/library settings.",
    tags: ["theme", "cross-media"],
  },
  // --- Mood ------------------------------------------------------------------
  {
    id: "mood-cozy-comedy",
    query: "cozy overnight small-town comedy",
    relevantSlugs: ["late-check-in", "under-the-eaves"],
    rationale: "Gentle slice-of-life comedies.",
    tags: ["mood"],
  },
  // --- Genre -----------------------------------------------------------------
  {
    id: "genre-science-fiction",
    query: "science fiction",
    relevantSlugs: [
      "dune-part-two",
      "quiet-signal",
      "arc-lighthouse",
      "northlight",
      "signal-glass",
      "seas-of-glass",
    ],
    rationale:
      "All sci-fi titles; note TV rows label the genre 'Sci-Fi', a known keyword gap semantic search should help close.",
    tags: ["genre", "cross-media"],
  },
  {
    id: "genre-mystery-tv",
    query: "mystery",
    relevantSlugs: ["harbour-lines", "signal-glass"],
    rationale: "Mystery TV series only.",
    tags: ["genre"],
    kind: "tv",
  },
  {
    id: "genre-short-stories",
    query: "short stories",
    relevantSlugs: ["the-weight-of-sand", "quiet-instruments"],
    rationale: "Short-story collections.",
    tags: ["genre"],
    kind: "book",
  },
  {
    id: "genre-romance",
    query: "romance",
    relevantSlugs: ["afterglow", "night-ferry", "ridge-and-river"],
    rationale: "Romance across film and TV.",
    tags: ["genre", "cross-media"],
  },
  // --- Person ----------------------------------------------------------------
  {
    id: "person-director",
    query: "Noor Salim",
    relevantSlugs: ["afterglow"],
    rationale: "Film director credit.",
    tags: ["person"],
  },
  {
    id: "person-author",
    query: "Ola Idris",
    relevantSlugs: ["seas-of-glass"],
    rationale: "Book author credit.",
    tags: ["person"],
  },
  {
    id: "person-creator",
    query: "Halle Renard",
    relevantSlugs: ["signal-glass"],
    rationale: "TV creator credit.",
    tags: ["person"],
  },
  // --- Negative --------------------------------------------------------------
  {
    id: "negative-zombies",
    query: "zombie apocalypse horror survival",
    relevantSlugs: [],
    rationale: "No catalog title matches; a confident match would be wrong.",
    tags: ["negative"],
  },
];

/**
 * Committed quality gates. A run exits non-zero if any is regressed. Tuned to
 * the deterministic (fake-embedding) baseline over the current catalog; live
 * OpenAI hybrid is expected to meet or exceed these.
 */
export const DEFAULT_THRESHOLDS: EvalThresholds = {
  minRecallAt5: 0.55,
  minMrr: 0.6,
  minExactTitleTop1Accuracy: 1.0,
  maxZeroResultRate: 0.12,
};
