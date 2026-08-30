/**
 * Shared, pure state + parsing contract for the MATERIALIZE-EXTERNAL-TITLE
 * Server Action, used with React's `useActionState`.
 *
 * Kept out of the `"use server"` actions module (which may only export async
 * functions) so both the client external-result card and the action can import
 * these types, and so the parser can be unit-tested without any server imports.
 *
 * The browser may submit ONLY the identity triplet needed to re-fetch trusted
 * detail — provider, media kind, and the provider-native external id — plus a
 * safe `returnTo` context. It NEVER submits a title, slug, year, synopsis,
 * artwork, rating, credits, authors, or any other provider metadata: the server
 * re-fetches and normalizes all of that from the provider. Authoritative
 * validation (provider serves the kind, external id well-formed) is left to the
 * server; this parser only reads the allow-listed raw fields.
 */

/** The raw, allow-listed identity fields read from the submitted form. */
export interface MaterializeFormInput {
  provider: string;
  kind: string;
  externalId: string;
}

function stringField(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value : "";
}

/**
 * Build a {@link MaterializeFormInput} from submitted form data. Pure and
 * defensive: reads ONLY provider / kind / externalId as raw strings, leaving all
 * validation and normalization to the server.
 */
export function parseMaterializeFormData(
  formData: FormData,
): MaterializeFormInput {
  return {
    provider: stringField(formData.get("provider")),
    kind: stringField(formData.get("kind")),
    externalId: stringField(formData.get("externalId")),
  };
}

export type MaterializeFormStatus =
  "idle" | "error" | "unavailable" | "unauthenticated" | "onboarding";

/**
 * The serializable state returned by the materialize action for
 * `useActionState`.
 *
 * NOTE: a SUCCESSFUL materialization does not resolve to a "success" status
 * here — the action performs an authoritative server `redirect(...)` to the new
 * canonical `/title/[slug]`, so control never returns to the client with a
 * success state. Only the non-redirecting failure/gate cases return a state.
 */
export interface MaterializeFormState {
  status: MaterializeFormStatus;
  /** Form-level, human-readable message (never a raw database/provider error). */
  message?: string;
  /** Safe, same-origin path for the auth / onboarding cases. */
  redirectTo?: string;
}

export const initialMaterializeFormState: MaterializeFormState = {
  status: "idle",
};
