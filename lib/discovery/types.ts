import type { ProviderErrorCategory } from "@/lib/catalog/errors";
import type { ExternalProvider, ExternalRef } from "@/lib/catalog/types";
import type { MediaKind } from "@/lib/types";

/**
 * Provider-backed discovery (Phase 4D).
 *
 * A discovery candidate is an EXTERNAL provider record, not a Favalog title. It
 * carries its explicit provider identity (`ref`), the provider's own rank, and
 * enough display data to render a card. It is never persisted as-is: saving one
 * goes through the trusted materializer, which re-fetches and normalizes detail.
 */

/** How a shelf is ordered. Each maps to a provider-side sort, never a local re-sort. */
export type DiscoverySort =
  "trending" | "popular" | "recent" | "upcoming" | "top-rated";

/**
 * The provider signal a shelf is ranked by. Recorded on every page so the UI
 * can say exactly what the order means and never compares signals across
 * providers as though they shared a scale.
 */
export type RankingSignal =
  | "tmdb-trending-week"
  | "tmdb-popularity"
  | "tmdb-vote-average"
  | "rawg-added"
  | "rawg-metacritic"
  | "openlibrary-trending-weekly";

export type DiscoveryShelfId =
  | "movie-trending"
  | "movie-popular"
  | "movie-recent"
  | "movie-upcoming"
  | "movie-top-rated"
  | "tv-trending"
  | "tv-popular"
  | "tv-recent"
  | "tv-top-rated"
  | "game-popular"
  | "game-recent"
  | "game-upcoming"
  | "game-top-rated"
  | "book-trending";

export interface DiscoveryCandidate {
  ref: ExternalRef;
  kind: MediaKind;
  title: string;
  year?: number;
  /** Full `YYYY-MM-DD` date, only when the provider states a real one. */
  releaseDate?: string;
  /** Poster/cover (portrait) or, for games, key art (landscape). */
  posterUrl?: string;
  backdropUrl?: string;
  overview?: string;
  /** 1-based position in the provider's own ordering for this shelf. */
  rank: number;
}

export interface DiscoveryPage {
  shelfId: DiscoveryShelfId;
  provider: ExternalProvider;
  kind: MediaKind;
  ranking: RankingSignal;
  page: number;
  hasMore: boolean;
  /** ISO time the provider data was actually fetched (not when it was served). */
  fetchedAt: string;
  candidates: DiscoveryCandidate[];
}

export type DiscoveryResult =
  | { status: "ok"; page: DiscoveryPage }
  | {
      status: "unavailable";
      shelfId: DiscoveryShelfId;
      reason: "disabled" | "provider-error";
      category?: ProviderErrorCategory;
    };
