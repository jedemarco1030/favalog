import type { ExternalRef } from "@/lib/catalog/types";

export const SAVE_INTENT_PARAM = "save";

/** A stable, URL-safe key for one provider title. */
export function saveIntentKey(ref: ExternalRef): string {
  return `${ref.provider}:${ref.kind}:${ref.externalId}`;
}

/**
 * Append (or replace) the save intent on a same-origin return path, so a
 * visitor who signs in to save a title comes back to that title's picker.
 * Any hash is preserved after the query.
 */
export function withSaveIntent(returnTo: string, ref: ExternalRef): string {
  const hashIndex = returnTo.indexOf("#");
  const hash = hashIndex >= 0 ? returnTo.slice(hashIndex) : "";
  const pathAndQuery = hashIndex >= 0 ? returnTo.slice(0, hashIndex) : returnTo;
  const queryIndex = pathAndQuery.indexOf("?");
  const path =
    queryIndex >= 0 ? pathAndQuery.slice(0, queryIndex) : pathAndQuery;
  const params = new URLSearchParams(
    queryIndex >= 0 ? pathAndQuery.slice(queryIndex + 1) : "",
  );
  params.set(SAVE_INTENT_PARAM, saveIntentKey(ref));
  return `${path || "/"}?${params.toString()}${hash}`;
}

/** Remove the save intent from a query string; returns the remaining query. */
export function withoutSaveIntent(search: string): string {
  const params = new URLSearchParams(search);
  params.delete(SAVE_INTENT_PARAM);
  const rest = params.toString();
  return rest ? `?${rest}` : "";
}
