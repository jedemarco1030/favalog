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
  // --- Negative controls -----------------------------------------------------
  // Human-reviewed queries with NO defensible catalog match. A confident result
  // for any of these is WRONG: nearest-neighbour search will always find a
  // closest vector, so these exercise the semantic relevance cutoff (plus the
  // keyword + exact-title contracts) doing their job. Each covers a distinct
  // failure mode. NOTE (small-catalog limitation): with only 28 curated titles
  // this is a deliberately small, coarse negative set — it demonstrates the
  // rejection behaviour rather than proving a finely-fit decision boundary.
  {
    id: "negative-zombies",
    query: "zombie apocalypse horror survival",
    relevantSlugs: [],
    rationale:
      "Clearly unavailable genre/premise: the catalog carries no zombie/horror survival title, so a confident match would be wrong.",
    tags: ["negative", "unavailable-media"],
  },
  {
    id: "negative-unavailable-title",
    query: "The Lord of the Rings: The Return of the King",
    relevantSlugs: [],
    rationale:
      "A famous, specific title Favalog does not carry. Exact-title protection must not fabricate a match, and no neighbour is a defensible substitute.",
    tags: ["negative", "unavailable-media", "exact-title-absent"],
  },
  {
    id: "negative-out-of-domain-taxes",
    query: "how to file my income taxes online this year",
    relevantSlugs: [],
    rationale:
      "Out-of-domain: a how-to/finance request has nothing to do with the movies/TV/books catalog.",
    tags: ["negative", "out-of-domain"],
  },
  {
    id: "negative-out-of-domain-espresso",
    query: "best espresso machine for a home barista under 500 dollars",
    relevantSlugs: [],
    rationale:
      "Out-of-domain product-shopping query with no defensible catalog match.",
    tags: ["negative", "out-of-domain"],
  },
  {
    id: "negative-gibberish",
    query: "asdf qwerty zxcvbnm plmoknijb wxyz",
    relevantSlugs: [],
    rationale:
      "Nonsense/gibberish: no lexical match and no meaningful embedding neighbour should clear the relevance floor.",
    tags: ["negative", "gibberish"],
  },
];

/**
 * Committed quality gates. A run exits non-zero if any is regressed. Tuned to
 * the deterministic (fake-embedding) baseline over the current catalog so the
 * secret-free regression check always enforces them; the live OpenAI hybrid is
 * expected to meet or exceed these.
 *
 * Note the two separate zero-result gates (see {@link EvalThresholds}):
 * `maxPositiveZeroResultRate` fails when a query that SHOULD match returns
 * nothing, while `minNegativeCleanRate` fails when a query that should NOT match
 * starts returning something (i.e. the semantic relevance cutoff / keyword /
 * exact-title rejection regressed). In deterministic mode the semantic arm's
 * fake vectors are (correctly) filtered out by the cosine cutoff, so hybrid
 * behaves like the KEYWORD baseline: negatives stay clean via lexical
 * non-matching, but purely natural-language positive queries with no lexical
 * overlap can miss. `maxPositiveZeroResultRate` is therefore set to the keyword
 * baseline's floor (which the deterministic gate must always meet); the live
 * OpenAI hybrid recovers most of those misses via the semantic arm and is
 * expected to sit far below this ceiling — that is where the cutoff earns its
 * keep on real vectors.
 */
export const DEFAULT_THRESHOLDS: EvalThresholds = {
  minRecallAt5: 0.55,
  minMrr: 0.6,
  minExactTitleTop1Accuracy: 1.0,
  maxPositiveZeroResultRate: 0.3,
  minNegativeCleanRate: 0.8,
};
