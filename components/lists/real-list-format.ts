import type { ListCreateVisibility, ListVisibility } from "@/lib/types";

/**
 * Pure formatting helpers for real (persistent) list surfaces.
 *
 * Kept free of any React/server import so both Server Components and unit tests
 * can reuse the exact same labels. Real lists deliberately carry no like count
 * or curator notes this phase, so nothing here fabricates those.
 */

/** Human, short visibility label for a real list, e.g. "Public" / "Private". */
export function visibilityLabel(visibility: ListVisibility): string {
  switch (visibility) {
    case "public":
      return "Public";
    case "private":
      return "Private";
    case "followers":
      // Reserved, not user-selectable this phase; treated like private.
      return "Private";
  }
}

/**
 * True when a list is only visible to its owner, so surfaces can flag it. The
 * reserved `followers` value behaves like private until follower-aware access
 * exists.
 */
export function isPrivateVisibility(visibility: ListVisibility): boolean {
  return visibility !== "public";
}

/**
 * Reconcile a stored {@link ListVisibility} to a creatable/editable value. Only
 * `public` maps to `public`; everything else (including the reserved
 * `followers`) reconciles to `private`, so the edit form never offers an
 * unsupported choice and a `followers` list pre-fills safely as private.
 */
export function toCreateVisibility(
  visibility: ListVisibility,
): ListCreateVisibility {
  return visibility === "public" ? "public" : "private";
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
