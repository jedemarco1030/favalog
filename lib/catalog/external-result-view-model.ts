/**
 * Pure, provider-neutral view models for a federated Explore external result
 * (Catalog Platform v1B).
 *
 * A {@link CatalogSearchCandidate} from a provider search is a cheap, lossy
 * preview. This module turns one into an {@link ExternalResultView} the UI can
 * render directly, and — critically — folds in the CANONICAL RESOLUTION already
 * performed server-side so the card knows whether the title is:
 *
 *   - `existing`   — already a Favalog title (an exact provider link or provider
 *                    row, OR a conservative deterministic candidate). The card
 *                    links straight to the canonical `/title/[slug]` and never
 *                    offers an import.
 *   - `importable` — not yet in Favalog. The card offers the trusted, identity-
 *                    only materialization action.
 *
 * Nothing here performs I/O, reads a secret, resolves identity, or throws: it is
 * a plain mapping module safe to import from server code, tests, and stories.
 * The resolution decision is made upstream (the server section) and injected —
 * never re-derived here, and never fuzzy/semantic.
 */

import type { ExternalProvider } from "./types";
import type { CatalogSearchCandidate } from "./types";
import type { MediaKind } from "@/lib/types";

/** Human-readable, provider-neutral attribution label. */
export const PROVIDER_LABEL: Record<ExternalProvider, string> = {
  tmdb: "TMDB",
  openlibrary: "Open Library",
};

/** Whether the external candidate is already a Favalog title or can be imported. */
export type ExternalResultStatus = "existing" | "importable";

/**
 * A fully-prepared external result for rendering. Carries ONLY safe, presented
 * fields plus the identity triplet needed to materialize — never a full detail
 * payload, rating, or any fabricated Favalog community data.
 */
export interface ExternalResultView {
  provider: ExternalProvider;
  /** Human-readable provider attribution label ("TMDB" / "Open Library"). */
  providerLabel: string;
  kind: MediaKind;
  /** Provider-native id WITHIN its kind (numeric for TMDB, Work id for books). */
  externalId: string;
  title: string;
  /** Release / first-publication year, when the provider supplies one. */
  year?: number;
  subtitle?: string;
  /** A safe, provider-derived poster/cover URL (already host-validated). */
  posterUrl?: string;
  /**
   * A concise, provider-derived creator/author line, when the candidate carries
   * one. Search candidates are lossy, so this is usually absent — deliberately
   * never fabricated.
   */
  creators?: string;
  status: ExternalResultStatus;
  /**
   * The canonical Favalog slug this result resolves to. Present ONLY when
   * `status === "existing"`; the card links to `/title/[existingSlug]`.
   */
  existingSlug?: string;
}

/**
 * Build the DB-native external key used to look a candidate up in the canonical
 * resolution map. Mirrors `externalKeyFor`: TMDB is kind-qualified
 * (`movie:603` / `tv:1399`); Open Library's Work id is already globally unique.
 * Kept local so this pure module needs no validation import.
 */
export function candidateResolutionKey(
  candidate: CatalogSearchCandidate,
): string {
  const { provider, kind, externalId } = candidate.ref;
  return provider === "tmdb" ? `${kind}:${externalId}` : externalId;
}

/**
 * Map a provider search candidate to an {@link ExternalResultView}, folding in
 * the canonical resolution decided upstream.
 *
 * @param candidate the provider search hit.
 * @param existingSlug the canonical slug this candidate resolves to, or
 *   `undefined` when it is not yet a Favalog title (importable).
 */
export function toExternalResultView(
  candidate: CatalogSearchCandidate,
  existingSlug: string | undefined,
): ExternalResultView {
  const provider = candidate.ref.provider;
  const base: ExternalResultView = {
    provider,
    providerLabel: PROVIDER_LABEL[provider],
    kind: candidate.kind,
    externalId: candidate.ref.externalId,
    title: candidate.title,
    ...(typeof candidate.year === "number" ? { year: candidate.year } : {}),
    ...(candidate.subtitle ? { subtitle: candidate.subtitle } : {}),
    ...(candidate.posterUrl ? { posterUrl: candidate.posterUrl } : {}),
    status: existingSlug ? "existing" : "importable",
  };
  return existingSlug ? { ...base, existingSlug } : base;
}

/**
 * Turn a page of provider candidates into the ordered external-result views to
 * present, applying canonical resolution and the federated presentation rules:
 *
 *   - a candidate whose canonical title is ALREADY shown in the local results
 *     (`localSlugs`) is dropped — never show duplicate local + external
 *     representations of the same title;
 *   - repeated candidates resolving to the SAME canonical title (or the same
 *     provider identity) are de-duplicated so a title appears at most once; and
 *   - the result is capped at `limit`.
 *
 * Pure: the resolution decision (`resolved`) is computed upstream (server-side,
 * exact identity only) and passed in. `resolved` maps a candidate's DB-native
 * external key (see {@link candidateResolutionKey}) to a canonical slug.
 */
export function buildExternalResultViews(
  candidates: readonly CatalogSearchCandidate[],
  resolved: ReadonlyMap<string, string>,
  localSlugs: Iterable<string>,
  limit: number,
): ExternalResultView[] {
  const local = new Set(localSlugs);
  const views: ExternalResultView[] = [];
  const seen = new Set<string>();

  for (const candidate of candidates) {
    if (views.length >= limit) break;
    const existingSlug = resolved.get(candidateResolutionKey(candidate));
    // Drop a candidate already represented in the local results.
    if (existingSlug && local.has(existingSlug)) continue;
    const view = toExternalResultView(candidate, existingSlug);
    const dedupeKey =
      existingSlug ?? `${view.provider}:${view.kind}:${view.externalId}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    views.push(view);
  }

  return views;
}
