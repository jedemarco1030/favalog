/**
 * Pure, bounded normalization helpers shared by every provider adapter.
 *
 * These enforce the "no unbounded provider content is ever persisted" rule:
 * every stored string is trimmed, whitespace-collapsed, and length-capped, and
 * every stored array is de-duplicated, item-capped, and element-capped. They are
 * pure functions (no I/O, no secrets) and are exhaustively unit-tested.
 */

import {
  MAX_GENRE_LENGTH,
  MAX_GENRES,
  MAX_PERSON_NAME_LENGTH,
  MAX_YEAR,
  MIN_YEAR,
} from "./config.ts";

/** Collapse whitespace and trim. Returns "" for a null/undefined/non-string. */
export function cleanText(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim();
}

/**
 * Clean a string and hard-cap its length. Truncation is on a character
 * boundary; the result is trimmed again so a cut never leaves a trailing space.
 */
export function capText(value: unknown, maxLength: number): string {
  const cleaned = cleanText(value);
  if (cleaned.length <= maxLength) return cleaned;
  return cleaned.slice(0, maxLength).trim();
}

/**
 * Normalize a list of strings: clean each element, drop blanks, cap each
 * element's length, de-duplicate (order-preserving, case-insensitive), and cap
 * the number of items. Non-array input yields an empty list.
 */
export function capList(
  value: unknown,
  maxItems: number,
  maxItemLength: number = MAX_PERSON_NAME_LENGTH,
): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of value) {
    if (out.length >= maxItems) break;
    const cleaned = capText(raw, maxItemLength);
    if (!cleaned) continue;
    const key = cleaned.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(cleaned);
  }
  return out;
}

/** Normalize a genre list with genre-specific caps. */
export function capGenres(value: unknown): string[] {
  return capList(value, MAX_GENRES, MAX_GENRE_LENGTH);
}

/**
 * Coerce a provider year value into a plausible integer year, or `undefined`
 * when absent/implausible. Accepts a number or a numeric/`YYYY-MM-DD` string.
 */
export function coerceYear(value: unknown): number | undefined {
  let year: number | undefined;
  if (typeof value === "number" && Number.isFinite(value)) {
    year = Math.trunc(value);
  } else if (typeof value === "string") {
    const match = /^\s*(\d{4})/.exec(value);
    if (match) year = Number.parseInt(match[1], 10);
  }
  if (year === undefined) return undefined;
  if (year < MIN_YEAR || year > MAX_YEAR) return undefined;
  return year;
}

/**
 * Coerce a provider rating (varies in scale by provider) into Favalog's 0–5
 * scale, rounded to two decimals, or `undefined` when absent/invalid.
 *
 * @param value    the raw rating
 * @param maxScale the provider's maximum (e.g. 10 for TMDB) so it can be
 *                 rescaled to 5
 */
export function coerceRating(
  value: unknown,
  maxScale: number,
): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  if (value <= 0 || maxScale <= 0) return undefined;
  const scaled = (value / maxScale) * 5;
  if (scaled <= 0) return undefined;
  const clamped = Math.min(5, scaled);
  return Math.round(clamped * 100) / 100;
}

/** Coerce a positive integer (runtime, page count, etc.) or 0 when absent/invalid. */
export function coercePositiveInt(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return Math.trunc(value);
  }
  if (typeof value === "string") {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return 0;
}
