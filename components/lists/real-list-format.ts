import type { ListCreateVisibility, ListVisibility } from "@/lib/types";

/**
 * Pure formatting helpers for real (persistent) list surfaces.
 *
 * Kept free of any React/server import so both Server Components and unit tests
 * can reuse the exact same labels. Real lists deliberately carry no like count
 * or curator notes this phase, so nothing here fabricates those.
 */

/** Human, short visibility label for a real list, e.g. "Public" / "Followers" / "Private". */
export function visibilityLabel(visibility: ListVisibility): string {
  switch (visibility) {
    case "public":
      return "Public";
    case "followers":
      return "Followers";
    case "private":
      return "Private";
  }
}

/**
 * True when a list is not public, so surfaces can flag it.
 */
export function isPrivateVisibility(visibility: ListVisibility): boolean {
  return visibility !== "public";
}

/**
 * Reconcile a stored {@link ListVisibility} to a creatable/editable value.
 */
export function toCreateVisibility(
  visibility: ListVisibility,
): ListCreateVisibility {
  return visibility;
}

const updatedFormatter = new Intl.DateTimeFormat("en", {
  month: "long",
  year: "numeric",
});

/** "Updated Month YYYY" for an ISO timestamp, falling back gracefully. */
export function formatUpdatedAt(iso: string): string | null {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return updatedFormatter.format(date);
}
