/**
 * Cross-media presentation order for "All media" local results.
 *
 * Local rows already share ONE comparable ranking (keyword/hybrid RRF from the
 * same database), so this never re-scores anything or mixes provider scores. It
 * only reorders the ranked list into lexical tiers and, within the non-exact
 * tiers, interleaves media kinds so one kind cannot fill every slot when strong
 * matches exist in several kinds. Each kind keeps its internal rank order.
 *
 * Tiers (query-agnostic, no title- or id-specific rules):
 *   1. exact title match (ignoring case, punctuation, and a leading article);
 *   2. the query appears as a whole-word phrase in the title;
 *   3. everything else (creator, genre, or semantic matches).
 *
 * Exact-title matches keep their original rank order and always lead.
 */

import type { MediaItem, MediaKind } from "@/lib/types";

const LEADING_ARTICLE = /^(the|a|an)\s+/;

export function normalizeTitleForMatch(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(LEADING_ARTICLE, "");
}

export type LexicalTier = 0 | 1 | 2;

export function lexicalTier(title: string, query: string): LexicalTier {
  const q = normalizeTitleForMatch(query);
  if (!q) return 2;
  const t = normalizeTitleForMatch(title);
  if (t === q) return 0;
  if (` ${t} `.includes(` ${q} `)) return 1;
  return 2;
}

function interleaveByKind<T extends { kind: MediaKind }>(items: T[]): T[] {
  const queues = new Map<MediaKind, T[]>();
  for (const item of items) {
    const queue = queues.get(item.kind);
    if (queue) queue.push(item);
    else queues.set(item.kind, [item]);
  }
  const order = Array.from(queues.values());
  const result: T[] = [];
  let remaining = items.length;
  while (remaining > 0) {
    for (const queue of order) {
      const next = queue.shift();
      if (next) {
        result.push(next);
        remaining -= 1;
      }
    }
  }
  return result;
}

/**
 * Reorder already-ranked local results for the "All media" view. Pure and
 * stable; returns a new array containing exactly the same items.
 */
export function balanceAcrossKinds<T extends Pick<MediaItem, "kind" | "title">>(
  items: readonly T[],
  query: string,
): T[] {
  const tiers: [T[], T[], T[]] = [[], [], []];
  for (const item of items) tiers[lexicalTier(item.title, query)].push(item);
  return [
    ...tiers[0],
    ...interleaveByKind(tiers[1]),
    ...interleaveByKind(tiers[2]),
  ];
}
