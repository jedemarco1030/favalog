/**
 * Form contract for saving a discovered (not yet materialized) provider title
 * straight into one of the viewer's lists. The client sends ONLY the provider
 * identity, a list id, and a return path — never title metadata or an owner id.
 */

export interface DiscoverySaveInput {
  provider: string;
  kind: string;
  externalId: string;
  listId: string;
}

function field(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value.trim() : "";
}

export function parseDiscoverySaveFormData(
  formData: FormData,
): DiscoverySaveInput {
  return {
    provider: field(formData.get("provider")),
    kind: field(formData.get("kind")),
    externalId: field(formData.get("externalId")),
    listId: field(formData.get("listId")),
  };
}

export type DiscoverySaveStatus =
  | "idle"
  | "success"
  | "error"
  | "unavailable"
  | "unauthenticated"
  | "onboarding";

export interface DiscoverySaveState {
  status: DiscoverySaveStatus;
  message?: string;
  redirectTo?: string;
  /** Canonical Favalog slug of the saved title. */
  mediaSlug?: string;
  listSlug?: string;
  listId?: string;
  alreadyPresent?: boolean;
}

export const initialDiscoverySaveState: DiscoverySaveState = { status: "idle" };
