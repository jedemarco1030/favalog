"use server";

import { revalidatePath } from "next/cache";

import { getCurrentProfile, getCurrentUser } from "@/lib/auth/data";
import { isProfileComplete } from "@/lib/auth/profile";
import { getSafeRedirectPath } from "@/lib/auth/safe-redirect";
import { isCatalogAdminConfigured } from "@/lib/catalog/admin-client";
import { CatalogProviderError } from "@/lib/catalog/errors";
import {
  isExternalProviderAvailable,
  shouldOfferExternalCatalog,
} from "@/lib/catalog/feature-flag";
import { logCatalogMaterialization } from "@/lib/catalog/log";
import { isAmbiguousMaterializeError } from "@/lib/catalog/materialize";
import { createServerCatalogMaterializer } from "@/lib/catalog/server-materializer";
import { validateMaterializeInput } from "@/lib/catalog/validation";
import { isUuid } from "@/lib/supabase/list-input";
import { addListItem } from "@/lib/supabase/lists";
import { logDiscoveryEvent } from "@/lib/discovery/log";
import { withSaveIntent } from "@/lib/discovery/save-intent";
import {
  parseDiscoverySaveFormData,
  type DiscoverySaveState,
} from "./save-form";

function withReturnTo(base: string, returnTo: string): string {
  if (!returnTo || returnTo === "/") return base;
  return `${base}?returnTo=${encodeURIComponent(returnTo)}`;
}

/**
 * Save a discovered provider title into one of the viewer's lists (Phase 4D).
 *
 * A public endpoint: it re-authenticates, requires a complete profile,
 * validates and allow-lists the provider identity, then materializes through
 * the trusted server materializer (which re-fetches and normalizes detail and
 * de-duplicates to an existing Favalog title) before adding the canonical slug
 * with the ordinary list mutation — which scopes the write to the signed-in
 * owner and is enforced again by RLS. The list id is only a lookup key.
 */
export async function saveDiscoveredTitleAction(
  _prevState: DiscoverySaveState,
  formData: FormData,
): Promise<DiscoverySaveState> {
  const raw = parseDiscoverySaveFormData(formData);
  const safeReturnTo = getSafeRedirectPath(formData.get("returnTo"), "/");
  const identity = validateMaterializeInput({
    provider: raw.provider,
    kind: raw.kind,
    externalId: raw.externalId,
  });
  const returnTo = identity.ok
    ? withSaveIntent(safeReturnTo, identity.value)
    : safeReturnTo;

  if (!shouldOfferExternalCatalog()) {
    return {
      status: "unavailable",
      message: "Saving titles from external sources isn't available right now.",
    };
  }

  const user = await getCurrentUser();
  if (!user) {
    return {
      status: "unauthenticated",
      message: "Please sign in to save this title.",
      redirectTo: withReturnTo("/auth/sign-in", returnTo),
    };
  }

  const profile = await getCurrentProfile();
  if (!isProfileComplete(profile)) {
    return {
      status: "onboarding",
      message: "Finish setting up your profile to save titles.",
      redirectTo: withReturnTo("/onboarding", returnTo),
    };
  }

  if (!identity.ok || !isUuid(raw.listId)) {
    return { status: "error", message: "That title can't be saved right now." };
  }
  const input = identity.value;

  if (!isExternalProviderAvailable(input.provider)) {
    return {
      status: "unavailable",
      message: "Saving titles from this source isn't available right now.",
    };
  }
  if (!isCatalogAdminConfigured()) {
    return {
      status: "unavailable",
      message: "Saving titles isn't available in this environment yet.",
    };
  }

  const startedAt = performance.now();
  let mediaSlug: string;
  try {
    const result = await createServerCatalogMaterializer().materialize(input);
    mediaSlug = result.slug;
    logCatalogMaterialization({
      provider: input.provider,
      outcome: "ok",
      resolution: result.resolution,
      latencyMs: performance.now() - startedAt,
      retries: 0,
    });
  } catch (error) {
    const ambiguous = isAmbiguousMaterializeError(error);
    logCatalogMaterialization({
      provider: input.provider,
      outcome: "error",
      ...(ambiguous ? { resolution: "ambiguous" as const } : {}),
      latencyMs: performance.now() - startedAt,
      retries: 0,
      errorCategory:
        error instanceof CatalogProviderError ? error.category : "unknown",
    });
    return {
      status: "error",
      message: ambiguous
        ? "We couldn't confirm which Favalog title this matches, so it wasn't saved."
        : "We couldn't save that title just now. Please try again in a moment.",
    };
  }

  const addStartedAt = performance.now();
  const added = await addListItem({ listId: raw.listId, mediaSlug });
  if (added.status !== "success") {
    logDiscoveryEvent({
      event: "discovery.save_add_failed",
      provider: input.provider,
      reason: added.status,
      latencyMs: performance.now() - addStartedAt,
    });
  }
  switch (added.status) {
    case "success":
      revalidatePath(`/list/${added.slug}`);
      revalidatePath(`/title/${mediaSlug}`);
      return {
        status: "success",
        mediaSlug,
        listSlug: added.slug,
        listId: added.listId,
        alreadyPresent: added.alreadyPresent,
      };
    case "unauthenticated":
      return {
        status: "unauthenticated",
        message: "Please sign in to save this title.",
        redirectTo: withReturnTo("/auth/sign-in", returnTo),
      };
    case "incomplete-profile":
      return {
        status: "onboarding",
        message: "Finish setting up your profile to save titles.",
        redirectTo: withReturnTo("/onboarding", returnTo),
      };
    case "unavailable":
      return {
        status: "unavailable",
        message: "Updating lists isn't available in this environment yet.",
      };
    case "invalid":
    case "error":
      return { status: "error", message: added.message, mediaSlug };
  }
}
