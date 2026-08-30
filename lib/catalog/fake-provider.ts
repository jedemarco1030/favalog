/**
 * Deterministic in-memory catalog provider.
 *
 * Backs offline tests, CI, and the operator CLI's `--fake` mode with a fixed,
 * secret-free dataset — no network, no credentials. It implements the same
 * {@link CatalogProvider} seam as the real adapters, so anything wired to a
 * provider (materialization, the CLI) works identically against it.
 *
 * Fake data must NEVER be written to a remote/hosted database; the CLI's
 * remote-write guard enforces that separately.
 */

import { providerError } from "./errors.ts";
import type {
  CatalogProvider,
  CatalogSearchCandidate,
  CatalogSearchOptions,
  ExternalProvider,
  ExternalRef,
  NormalizedMediaItem,
  ProviderPage,
} from "./types";
import { clampPage, normalizeQuery } from "./validation.ts";

/** Options for {@link createFakeProvider}. */
export interface FakeProviderOptions {
  id?: ExternalProvider;
  /** The fixed catalog this fake serves. Defaults to {@link DEFAULT_FAKE_ITEMS}. */
  items?: NormalizedMediaItem[];
}

/**
 * A small, deterministic dataset spanning all three kinds so the fake exercises
 * every normalization path. Ids are stable; the shapes satisfy the strict
 * normalized union.
 */
export const DEFAULT_FAKE_ITEMS: NormalizedMediaItem[] = [
  {
    ref: { provider: "tmdb", kind: "movie", externalId: "1001" },
    kind: "movie",
    title: "Fixture Movie One",
    synopsis: "A deterministic fixture movie used for offline testing.",
    year: 2020,
    genres: ["Drama"],
    posterUrl: "https://image.tmdb.org/t/p/w500/fixture1.jpg",
    runtimeMinutes: 110,
    director: "Fixture Director",
    cast: ["Actor A", "Actor B"],
  },
  {
    ref: { provider: "tmdb", kind: "tv", externalId: "2001" },
    kind: "tv",
    title: "Fixture Series One",
    synopsis: "A deterministic fixture series used for offline testing.",
    year: 2021,
    genres: ["Sci-Fi", "Drama"],
    seasons: 2,
    episodes: 16,
    creators: ["Fixture Creator"],
    status: "ongoing",
  },
  {
    ref: { provider: "openlibrary", kind: "book", externalId: "OL1001W" },
    kind: "book",
    title: "Fixture Book One",
    synopsis: "A deterministic fixture book used for offline testing.",
    year: 2019,
    genres: ["Literary Fiction"],
    authors: ["Fixture Author"],
    pageCount: 0,
  },
];

/** Create a deterministic {@link CatalogProvider} over a fixed dataset. */
export function createFakeProvider(
  options: FakeProviderOptions = {},
): CatalogProvider {
  const id = options.id ?? "tmdb";
  const items = options.items ?? DEFAULT_FAKE_ITEMS;
  const forThisProvider = items.filter((item) => item.ref.provider === id);
  const kinds = Array.from(new Set(forThisProvider.map((i) => i.kind)));

  function toCandidate(item: NormalizedMediaItem): CatalogSearchCandidate {
    return {
      ref: item.ref,
      kind: item.kind,
      title: item.title,
      year: item.year,
      subtitle: item.subtitle,
      posterUrl: item.posterUrl,
    };
  }

  return {
    id,
    kinds: kinds.length > 0 ? kinds : ["movie"],

    async search(
      opts: CatalogSearchOptions,
    ): Promise<ProviderPage<CatalogSearchCandidate>> {
      const validated = normalizeQuery(opts.query);
      if (!validated.ok) {
        throw providerError(
          { provider: id, operation: "search", category: "validation" },
          `[${id}] search failed: ${validated.error}`,
        );
      }
      const page = clampPage(opts.page);
      const needle = validated.value.toLowerCase();
      const kind = opts.kind ?? "all";
      const items = forThisProvider
        .filter((item) => kind === "all" || item.kind === kind)
        .filter((item) => item.title.toLowerCase().includes(needle))
        .map(toCandidate);
      return { items, page, totalPages: 1, hasMore: false };
    },

    async getByExternalId(ref: ExternalRef): Promise<NormalizedMediaItem> {
      const found = forThisProvider.find(
        (item) =>
          item.ref.kind === ref.kind && item.ref.externalId === ref.externalId,
      );
      if (!found) {
        throw providerError({
          provider: id,
          operation: "getByExternalId",
          category: "not_found",
        });
      }
      return found;
    },
  };
}
