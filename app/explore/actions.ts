"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getCurrentProfile, getCurrentUser } from "@/lib/auth/data";
import { isProfileComplete } from "@/lib/auth/profile";
import { getSafeRedirectPath } from "@/lib/auth/safe-redirect";
import { isCatalogAdminConfigured } from "@/lib/catalog/admin-client";
import { CatalogProviderError } from "@/lib/catalog/errors";
import { shouldOfferExternalCatalog } from "@/lib/catalog/feature-flag";
import {
  logCatalogMaterialization,
  type MaterializeResolutionOutcome,
} from "@/lib/catalog/log";
import { isAmbiguousMaterializeError } from "@/lib/catalog/materialize";
import { createServerCatalogMaterializer } from "@/lib/catalog/server-materializer";
import { validateMaterializeInput } from "@/lib/catalog/validation";
import {
  parseMaterializeFormData,
  type MaterializeFormState,
} from "./materialize-form";

/**
 * `"use server"` boundary for materializing an external catalog result into
 * Favalog (Catalog Platform v1B). This is the ONLY client-callable entry point
 * for turning a TMDB / Open Library result into a persistent Favalog title.
 *
 * Treated as a public endpoint, it:
 *
 *   - accepts ONLY the identity triplet (provider / kind / external id) plus a
 *     safe `returnTo` — never a title, slug, year, synopsis, artwork, rating,
 *     credits, authors, or any other provider metadata (the server re-fetches
 *     and normalizes trusted detail itself);
 *   - independently re-authenticates via the server-only auth DAL and requires a
 *     COMPLETE onboarded profile before any write, routing a signed-out caller
 *     through the safe sign-in `returnTo` flow and an incomplete profile to
 *     onboarding (every redirect target is server-built and validated);
 *   - validates + allow-lists the identity, then delegates to the trusted,
 *     canonically-resolving server materializer (which re-fetches detail,
 *     normalizes, and de-duplicates a provider identity to an existing Favalog
 *     title before ever creating a new row);
 *   - revalidates Explore and the affected canonical title route, then performs
 *     an AUTHORITATIVE server redirect to `/title/[slug]` (so a success never
 *     returns an optimistic client state); and
 *   - maps every provider/database failure to a stable, serializable
 *     {@link MaterializeFormState}, never a raw provider/Postgres error.
 *
 * Unit-tested by mocking the auth DAL, the server materializer, and Next's
 * `redirect`/`revalidatePath` (the established pattern for the other actions).
 */
export async function materializeExternalTitleAction(
  _prevState: MaterializeFormState,
  formData: FormData,
): Promise<MaterializeFormState> {
  const raw = parseMaterializeFormData(formData);
  // The only navigation context we ever build from the request; always validated.
  const returnTo = getSafeRedirectPath(formData.get("returnTo"), "/explore");

  // Defense in depth: the UI already gates external discovery behind the flag,
  // but the action re-checks so a stale/forged submit can't materialize when the
  // feature is off or no provider is configured.
  if (!shouldOfferExternalCatalog()) {
    return {
      status: "unavailable",
      message: "Adding titles from external sources isn't available right now.",
    };
  }

  const user = await getCurrentUser();
  if (!user) {
    return {
      status: "unauthenticated",
      message: "Please sign in to add this title to Favalog.",
      redirectTo: withReturnTo("/auth/sign-in", returnTo),
    };
  }

  const profile = await getCurrentProfile();
  if (!isProfileComplete(profile)) {
    return {
      status: "onboarding",
      message: "Finish setting up your profile to add titles.",
      redirectTo: withReturnTo("/onboarding", returnTo),
    };
  }

  // Validate + allow-list the identity triplet (provider serves the kind, id
  // well-formed). A malformed identity never reaches a provider or the database.
  const validated = validateMaterializeInput({
    provider: raw.provider,
    kind: raw.kind,
    externalId: raw.externalId,
  });
  if (!validated.ok) {
    return {
      status: "error",
      message: "That title can't be added right now.",
    };
  }
  const input = validated.value;

  // Trusted writes require the service-role admin client. In an environment
  // without it (e.g. a no-env build), report a controlled unavailable state
  // rather than throwing.
  if (!isCatalogAdminConfigured()) {
    return {
      status: "unavailable",
      message: "Adding titles isn't available in this environment yet.",
    };
  }

  const startedAt = performance.now();
  let slug: string;
  try {
    const materializer = createServerCatalogMaterializer();
    const result = await materializer.materialize(input);
    slug = result.slug;
    logCatalogMaterialization({
      provider: input.provider,
      outcome: "ok",
      resolution: result.resolution as MaterializeResolutionOutcome | undefined,
      latencyMs: performance.now() - startedAt,
      retries: 0,
    });
  } catch (error) {
    const ambiguous = isAmbiguousMaterializeError(error);
    const category =
      error instanceof CatalogProviderError ? error.category : "unknown";
    logCatalogMaterialization({
      provider: input.provider,
      outcome: "error",
      ...(ambiguous ? { resolution: "ambiguous" as const } : {}),
      latencyMs: performance.now() - startedAt,
      retries: 0,
      errorCategory: category,
    });
    return {
      status: "error",
      message: ambiguous
        ? "We couldn't confirm which Favalog title this matches, so it wasn't added. Try searching Favalog directly."
        : "We couldn't add that title just now. Please try again in a moment.",
    };
  }

  // Revalidate every surface the new/updated title affects, then redirect
  // authoritatively to its canonical route. `redirect` MUST run outside the
  // try/catch so its control-flow signal is never swallowed.
  revalidatePath("/explore");
  if (slug) revalidatePath(`/title/${slug}`);
  redirect(getSafeRedirectPath(`/title/${slug}`, "/explore"));
}

/** Append a validated `returnTo` query to a base path (omitted for "/"). */
function withReturnTo(base: string, returnTo: string): string {
  if (!returnTo || returnTo === "/") return base;
  return `${base}?returnTo=${encodeURIComponent(returnTo)}`;
}
