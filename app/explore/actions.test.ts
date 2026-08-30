import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Server Action contract for materializing an external catalog result.
 *
 * Proves the trust-minimizing gate: the feature flag, an independent auth
 * re-check, and profile completeness are ALL enforced before any write; a
 * successful materialization performs an authoritative SERVER redirect to the
 * new canonical `/title/[slug]` (never an optimistic client success); and every
 * failure maps to a safe, serializable state without a server redirect.
 */

const redirect = vi.fn((path: string): never => {
  throw new Error(`NEXT_REDIRECT:${path}`);
});
vi.mock("next/navigation", () => ({ redirect: (p: string) => redirect(p) }));

const revalidatePath = vi.fn();
vi.mock("next/cache", () => ({
  revalidatePath: (p: string) => revalidatePath(p),
}));

const getCurrentUser = vi.fn();
const getCurrentProfile = vi.fn();
vi.mock("@/lib/auth/data", () => ({
  getCurrentUser: () => getCurrentUser(),
  getCurrentProfile: () => getCurrentProfile(),
}));

const shouldOfferExternalCatalog = vi.fn();
vi.mock("@/lib/catalog/feature-flag", () => ({
  shouldOfferExternalCatalog: () => shouldOfferExternalCatalog(),
}));

const isCatalogAdminConfigured = vi.fn();
vi.mock("@/lib/catalog/admin-client", () => ({
  isCatalogAdminConfigured: () => isCatalogAdminConfigured(),
}));

const materialize = vi.fn();
const createServerCatalogMaterializer = vi.fn(() => ({ materialize }));
vi.mock("@/lib/catalog/server-materializer", () => ({
  createServerCatalogMaterializer: () => createServerCatalogMaterializer(),
}));

import { materializeExternalTitleAction } from "@/app/explore/actions";
import { initialMaterializeFormState } from "@/app/explore/materialize-form";
import {
  AMBIGUOUS_MATERIALIZE_MESSAGE,
  CatalogProviderError,
} from "@/lib/catalog/materialize";

const COMPLETE_PROFILE = {
  username: "jamie",
  displayName: "Jamie",
} as unknown as NonNullable<Awaited<ReturnType<typeof getCurrentProfile>>>;

function form(extra: Record<string, string> = {}): FormData {
  const fd = new FormData();
  fd.set("provider", "tmdb");
  fd.set("kind", "movie");
  fd.set("externalId", "693134");
  for (const [k, v] of Object.entries(extra)) fd.set(k, v);
  return fd;
}

describe("materializeExternalTitleAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    shouldOfferExternalCatalog.mockReturnValue(true);
    getCurrentUser.mockResolvedValue({ id: "user-1" });
    getCurrentProfile.mockResolvedValue(COMPLETE_PROFILE);
    isCatalogAdminConfigured.mockReturnValue(true);
  });

  it("redirects authoritatively to the canonical title on success", async () => {
    materialize.mockResolvedValue({
      slug: "dune-part-two",
      resolution: "created",
    });

    await expect(
      materializeExternalTitleAction(initialMaterializeFormState, form()),
    ).rejects.toThrow("NEXT_REDIRECT:/title/dune-part-two");

    expect(materialize).toHaveBeenCalledTimes(1);
    expect(revalidatePath).toHaveBeenCalledWith("/explore");
    expect(revalidatePath).toHaveBeenCalledWith("/title/dune-part-two");
    expect(redirect).toHaveBeenCalledWith("/title/dune-part-two");
  });

  it("redirects to an existing canonical title (no duplicate) on a linked outcome", async () => {
    materialize.mockResolvedValue({
      slug: "dune-part-two",
      resolution: "linked",
    });

    await expect(
      materializeExternalTitleAction(initialMaterializeFormState, form()),
    ).rejects.toThrow("NEXT_REDIRECT:/title/dune-part-two");
    expect(redirect).toHaveBeenCalledWith("/title/dune-part-two");
  });

  it("returns an unauthenticated state with a safe sign-in redirect when signed out", async () => {
    getCurrentUser.mockResolvedValue(null);

    const result = await materializeExternalTitleAction(
      initialMaterializeFormState,
      form({ returnTo: "/explore?q=dune" }),
    );

    expect(result.status).toBe("unauthenticated");
    expect(result.redirectTo).toBe(
      "/auth/sign-in?returnTo=%2Fexplore%3Fq%3Ddune",
    );
    expect(materialize).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
  });

  it("routes an incomplete profile to onboarding", async () => {
    getCurrentProfile.mockResolvedValue({ username: "", displayName: "" });

    const result = await materializeExternalTitleAction(
      initialMaterializeFormState,
      form({ returnTo: "/explore?q=dune" }),
    );

    expect(result.status).toBe("onboarding");
    expect(result.redirectTo).toContain("/onboarding");
    expect(materialize).not.toHaveBeenCalled();
  });

  it("is unavailable when the feature flag is off (no write)", async () => {
    shouldOfferExternalCatalog.mockReturnValue(false);

    const result = await materializeExternalTitleAction(
      initialMaterializeFormState,
      form(),
    );

    expect(result.status).toBe("unavailable");
    expect(materialize).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
  });

  it("rejects a malformed identity before any write", async () => {
    const result = await materializeExternalTitleAction(
      initialMaterializeFormState,
      form({ kind: "book" }), // TMDB does not serve books
    );

    expect(result.status).toBe("error");
    expect(materialize).not.toHaveBeenCalled();
  });

  it("is unavailable when the service-role admin client is not configured", async () => {
    isCatalogAdminConfigured.mockReturnValue(false);

    const result = await materializeExternalTitleAction(
      initialMaterializeFormState,
      form(),
    );

    expect(result.status).toBe("unavailable");
    expect(materialize).not.toHaveBeenCalled();
  });

  it("maps a generic provider/db failure to a safe error, no redirect", async () => {
    materialize.mockRejectedValue(
      new CatalogProviderError("boom", {
        provider: "tmdb",
        operation: "materialize",
        category: "unavailable",
      }),
    );

    const result = await materializeExternalTitleAction(
      initialMaterializeFormState,
      form(),
    );

    expect(result.status).toBe("error");
    expect(result.message).not.toContain("boom");
    expect(redirect).not.toHaveBeenCalled();
  });

  it("presents a distinct safe message for an ambiguous canonical match", async () => {
    materialize.mockRejectedValue(
      new CatalogProviderError(AMBIGUOUS_MATERIALIZE_MESSAGE, {
        provider: "tmdb",
        operation: "materialize",
        category: "validation",
      }),
    );

    const result = await materializeExternalTitleAction(
      initialMaterializeFormState,
      form(),
    );

    expect(result.status).toBe("error");
    expect(result.message).toMatch(/couldn't confirm which Favalog title/i);
    expect(redirect).not.toHaveBeenCalled();
  });
});
