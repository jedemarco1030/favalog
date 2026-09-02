/**
 * Canonical Favalog book-genre taxonomy + the pure mapping applied at the Open
 * Library normalization boundary.
 *
 * Open Library `subjects` are a sprawling, uncontrolled folksonomy. They mix a
 * handful of genuine genres in amongst classifications, awards, bestseller-list
 * metadata, provider query syntax, dates, places, characters, people,
 * organizations, and free-form cataloguing prose. Persisting them verbatim as
 * "genres" pollutes the browse Genre menu and every title page (for example
 * `award:nebula_award=novel`, `nyt:mass-market-monthly=2021-11-07`,
 * `Dune (Imaginary place)`, or `Fiction, science fiction, general`).
 *
 * {@link canonicalizeBookGenres} maps trusted provider subjects into a small,
 * closed, user-facing set of product genres. It is:
 *
 *   - small and user-facing (the closed {@link CANONICAL_BOOK_GENRES} list);
 *   - stable across providers (a fixed vocabulary, not derived from input);
 *   - case-insensitive and whitespace-insensitive;
 *   - deduplicated and deterministic (first-seen order preserved);
 *   - explicitly allow-listed, mapping known aliases
 *     (`Sci-Fi`, `Science-fiction`, `Fiction, science fiction, general`, …) to
 *     one canonical value;
 *   - FAIL-CLOSED: anything not recognised is dropped, never guessed.
 *
 * It deliberately does NOT special-case any single title or Work id; the rules
 * generalize to every future Open Library import.
 *
 * Raw subjects are provider TAGS, not genres. They are intentionally not exposed
 * here; if a future phase wants them (e.g. for retrieval signals) they must be
 * stored under a separate, clearly-named field — never re-surfaced as genres.
 */

import { MAX_GENRES } from "../config.ts";

/**
 * The closed, ordered Favalog book-genre taxonomy. Order is the display /
 * tie-break priority. Values are the exact stored casing and match the existing
 * curated catalog vocabulary so browse filtering and displayed genres share one
 * vocabulary.
 */
export const CANONICAL_BOOK_GENRES = [
  "Literary Fiction",
  "Science Fiction",
  "Fantasy",
  "Speculative",
  "Mystery",
  "Thriller",
  "Romance",
  "Horror",
  "Adventure",
  "Historical Fiction",
  "Young Adult",
  "Children's",
  "Short Stories",
  "Poetry",
  "Fiction",
  "Biography",
  "Memoir",
  "History",
  "Essays",
  "Nonfiction",
] as const;

/** A canonical book genre from the closed taxonomy. */
export type CanonicalBookGenre = (typeof CANONICAL_BOOK_GENRES)[number];

/**
 * The two GENERIC umbrella genres. When a single subject string resolves to
 * both a generic and a more specific genre (e.g. "Fiction, science fiction,
 * general"), the specific one wins so we emit exactly one canonical value.
 */
const GENERIC_GENRES: ReadonlySet<CanonicalBookGenre> = new Set([
  "Fiction",
  "Nonfiction",
]);

/**
 * Allow-list of normalized aliases → canonical genre. Keys are normalized with
 * {@link normalizeToken} (lower-cased, whitespace-collapsed, surrounding
 * punctuation stripped). Anything not present here is rejected.
 */
const ALIASES: ReadonlyMap<string, CanonicalBookGenre> = new Map(
  Object.entries({
    // Science Fiction
    "science fiction": "Science Fiction",
    "science-fiction": "Science Fiction",
    sciencefiction: "Science Fiction",
    "sci-fi": "Science Fiction",
    "sci fi": "Science Fiction",
    scifi: "Science Fiction",
    sf: "Science Fiction",
    // Fantasy
    fantasy: "Fantasy",
    "fantasy fiction": "Fantasy",
    "epic fantasy": "Fantasy",
    "high fantasy": "Fantasy",
    // Speculative
    speculative: "Speculative",
    "speculative fiction": "Speculative",
    // Mystery
    mystery: "Mystery",
    "mystery fiction": "Mystery",
    "mystery and detective stories": "Mystery",
    "detective and mystery stories": "Mystery",
    detective: "Mystery",
    crime: "Mystery",
    "crime fiction": "Mystery",
    // Thriller
    thriller: "Thriller",
    thrillers: "Thriller",
    suspense: "Thriller",
    "psychological thriller": "Thriller",
    // Romance
    romance: "Romance",
    "romance fiction": "Romance",
    romantic: "Romance",
    // Horror
    horror: "Horror",
    "horror fiction": "Horror",
    "horror tales": "Horror",
    // Adventure
    adventure: "Adventure",
    "adventure fiction": "Adventure",
    "adventure stories": "Adventure",
    "action and adventure": "Adventure",
    "action & adventure": "Adventure",
    // Historical Fiction
    "historical fiction": "Historical Fiction",
    historical: "Historical Fiction",
    // Young Adult
    "young adult": "Young Adult",
    "young adult fiction": "Young Adult",
    "young adult literature": "Young Adult",
    ya: "Young Adult",
    // Children's
    "children's": "Children's",
    childrens: "Children's",
    children: "Children's",
    "children's fiction": "Children's",
    "childrens fiction": "Children's",
    "juvenile fiction": "Children's",
    juvenile: "Children's",
    "picture books": "Children's",
    // Short Stories
    "short stories": "Short Stories",
    "short story": "Short Stories",
    stories: "Short Stories",
    // Poetry
    poetry: "Poetry",
    poems: "Poetry",
    // Literary Fiction
    "literary fiction": "Literary Fiction",
    literary: "Literary Fiction",
    // Fiction (generic)
    fiction: "Fiction",
    "general fiction": "Fiction",
    // Biography
    biography: "Biography",
    biographies: "Biography",
    autobiography: "Biography",
    "biography & autobiography": "Biography",
    "biography and autobiography": "Biography",
    // Memoir
    memoir: "Memoir",
    memoirs: "Memoir",
    "personal memoirs": "Memoir",
    // History
    history: "History",
    "world history": "History",
    // Essays
    essays: "Essays",
    essay: "Essays",
    // Nonfiction (generic)
    nonfiction: "Nonfiction",
    "non-fiction": "Nonfiction",
    "non fiction": "Nonfiction",
  } satisfies Record<string, CanonicalBookGenre>),
);

/** Priority index of a canonical genre (lower = earlier in the taxonomy). */
const PRIORITY: ReadonlyMap<CanonicalBookGenre, number> = new Map(
  CANONICAL_BOOK_GENRES.map((genre, index) => [genre, index]),
);

/**
 * Normalize a single token for alias lookup: lower-case, collapse internal
 * whitespace, trim, and strip surrounding punctuation (quotes, periods, dashes).
 * Apostrophes are preserved so `children's` still matches.
 */
function normalizeToken(value: string): string {
  return value
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^[\s"'.,;:_/-]+/, "")
    .replace(/[\s".,;:_/-]+$/, "")
    .trim();
}

/**
 * Resolve ONE raw subject string to a single canonical genre, or `null`.
 *
 * Provider query syntax (`:` / `=`) and any embedded digit (dates, years, list
 * identifiers) reject the whole subject outright. Otherwise the subject is split
 * on commas and each token is matched independently; tokens carrying an entity
 * qualifier in parentheses (e.g. `Dune (Imaginary place)`) are ignored. When
 * more than one canonical genre matches within the subject, the most SPECIFIC
 * one wins so a composite like "Fiction, science fiction, general" yields a
 * single "Science Fiction".
 */
function resolveSubject(raw: string): CanonicalBookGenre | null {
  const subject = raw.trim();
  if (subject.length === 0) return null;
  // Provider query syntax / classification key-value pairs are never genres.
  if (subject.includes(":") || subject.includes("=")) return null;
  // Any digit signals a date, year, or list identifier — not a genre.
  if (/\d/.test(subject)) return null;

  let best: CanonicalBookGenre | null = null;
  let bestRank = -1;

  for (const token of subject.split(",")) {
    // Entity qualifiers ("… (Imaginary place)", "… (Fictitious character)")
    // mark a place/character/person, not a genre.
    if (token.includes("(") || token.includes(")")) continue;
    const canonical = ALIASES.get(normalizeToken(token));
    if (!canonical) continue;

    // Prefer a specific genre over a generic umbrella; among equally
    // specific/generic matches, prefer the earlier taxonomy entry.
    const generic = GENERIC_GENRES.has(canonical);
    const rank = (generic ? 0 : 1000) + (1000 - (PRIORITY.get(canonical) ?? 0));
    if (rank > bestRank) {
      bestRank = rank;
      best = canonical;
    }
  }

  return best;
}

/**
 * Map trusted Open Library subjects into the closed Favalog book-genre taxonomy.
 *
 * Deterministic, case-insensitive, deduplicated, and fail-closed: unknown or
 * non-genre subjects are dropped rather than guessed. Non-array / non-string
 * input degrades to an empty list. The result preserves first-seen order and is
 * capped at {@link MAX_GENRES}.
 */
export function canonicalizeBookGenres(
  subjects: unknown,
): CanonicalBookGenre[] {
  if (!Array.isArray(subjects)) return [];
  const seen = new Set<CanonicalBookGenre>();
  const out: CanonicalBookGenre[] = [];
  for (const raw of subjects) {
    if (out.length >= MAX_GENRES) break;
    if (typeof raw !== "string") continue;
    const canonical = resolveSubject(raw);
    if (!canonical || seen.has(canonical)) continue;
    seen.add(canonical);
    out.push(canonical);
  }
  return out;
}
