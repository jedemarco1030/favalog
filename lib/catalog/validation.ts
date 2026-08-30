/**
 * Input validation + limits for the catalog layer.
 *
 * All caller-supplied input (a search query, a page number, a materialization
 * identity) is validated HERE before it ever reaches a provider or the database.
 * Validation is strict and fail-closed: an out-of-range or malformed value is
 * rejected with a safe, secret-free message rather than silently coerced into
 * something surprising.
 *
 * Pure module: no I/O, no secrets.
 */

import { MAX_PAGE, MAX_QUERY_LENGTH, MIN_QUERY_LENGTH } from "./config.ts";
import type { ExternalProvider, MaterializeInput } from "./types";
import type { MediaKind } from "@/lib/types";

/** A successful validation carrying the cleaned value, or a safe error. */
export type Validated<T> =
  { ok: true; value: T } | { ok: false; error: string };

/** The media kinds each provider serves. Identity guard: TMDB has no books, etc. */
export const PROVIDER_KINDS: Record<ExternalProvider, readonly MediaKind[]> = {
  tmdb: ["movie", "tv"],
  openlibrary: ["book"],
};

/** All valid provider ids. */
const PROVIDERS: ReadonlySet<string> = new Set<ExternalProvider>([
  "tmdb",
  "openlibrary",
]);

/** All valid media kinds. */
const KINDS: ReadonlySet<string> = new Set<MediaKind>(["movie", "tv", "book"]);

/** Narrow an arbitrary string to a known provider id, or `null`. */
export function parseProvider(
  raw: string | undefined,
): ExternalProvider | null {
  if (raw && PROVIDERS.has(raw)) return raw as ExternalProvider;
  return null;
}

/** Narrow an arbitrary string to a known media kind, or `null`. */
export function parseMediaKind(raw: string | undefined): MediaKind | null {
  if (raw && KINDS.has(raw)) return raw as MediaKind;
  return null;
}

/**
 * Normalize + validate a search query. Trims and collapses whitespace, then
 * enforces the min/max length window. Rejects blank or over-long input.
 */
export function normalizeQuery(raw: string | undefined): Validated<string> {
  const value = (raw ?? "").replace(/\s+/g, " ").trim();
  if (value.length < MIN_QUERY_LENGTH) {
    return {
      ok: false,
      error: `query must be at least ${MIN_QUERY_LENGTH} characters`,
    };
  }
  if (value.length > MAX_QUERY_LENGTH) {
    return {
      ok: false,
      error: `query must be at most ${MAX_QUERY_LENGTH} characters`,
    };
  }
  return { ok: true, value };
}

/** Clamp a 1-based page into `[1, MAX_PAGE]`, defaulting to 1. */
export function clampPage(page: number | undefined): number {
  if (typeof page !== "number" || !Number.isFinite(page)) return 1;
  const floored = Math.floor(page);
  if (floored < 1) return 1;
  if (floored > MAX_PAGE) return MAX_PAGE;
  return floored;
}

/**
 * Validate a provider-native external id for a given provider + kind.
 *
 *   - TMDB movie/tv ids are positive integers (the API's numeric id space).
 *   - Open Library Work ids match `OL\d+W` (e.g. `OL45804W`). The trailing `W`
 *     distinguishes a Work from an Edition (`M`) or Author (`A`); Favalog uses
 *     the Work as the canonical book identity.
 */
export function validateExternalId(
  provider: ExternalProvider,
  kind: MediaKind,
  externalId: string,
): Validated<string> {
  const id = externalId.trim();
  if (id === "") return { ok: false, error: "externalId must not be empty" };

  if (provider === "tmdb") {
    if (!/^\d+$/.test(id)) {
      return { ok: false, error: "TMDB externalId must be a positive integer" };
    }
    return { ok: true, value: id };
  }

  // openlibrary
  if (kind === "book") {
    if (!/^OL\d+W$/.test(id)) {
      return {
        ok: false,
        error: "Open Library externalId must be a Work id like 'OL45804W'",
      };
    }
    return { ok: true, value: id };
  }

  return { ok: false, error: "unsupported provider/kind combination" };
}

/**
 * Compose the DB-native `external_id` for a provider identity.
 *
 * TMDB reuses one numeric id space across movies and TV, so its stored
 * `external_id` is kind-qualified (`movie:603` / `tv:1399`) to guarantee a
 * movie and a TV show can never collide on the `(source, external_id)` identity.
 * Open Library's Work id is already globally unique, so it is stored as-is.
 */
export function externalKeyFor(
  provider: ExternalProvider,
  kind: MediaKind,
  externalId: string,
): string {
  return provider === "tmdb" ? `${kind}:${externalId}` : externalId;
}

/**
 * Validate a full materialization identity: the provider and kind are known,
 * the provider actually serves that kind, and the external id is well-formed.
 * Returns a cleaned {@link MaterializeInput} or a safe error.
 */
export function validateMaterializeInput(input: {
  provider: string | undefined;
  kind: string | undefined;
  externalId: string | undefined;
}): Validated<MaterializeInput> {
  const provider = parseProvider(input.provider);
  if (!provider) return { ok: false, error: "unknown provider" };

  const kind = parseMediaKind(input.kind);
  if (!kind) return { ok: false, error: "unknown media kind" };

  if (!PROVIDER_KINDS[provider].includes(kind)) {
    return {
      ok: false,
      error: `provider '${provider}' does not serve '${kind}'`,
    };
  }

  const externalId = validateExternalId(provider, kind, input.externalId ?? "");
  if (!externalId.ok) return externalId;

  return {
    ok: true,
    value: { provider, kind, externalId: externalId.value },
  };
}
