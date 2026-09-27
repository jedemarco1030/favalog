import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Server Action contract for saving a discovered provider title straight into
 * one of the viewer's lists: every gate runs before any write, the client can
 * only supply provider identity + a list id, and failures map to safe states.
 */

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
const isExternalProviderAvailable = vi.fn();
vi.mock("@/lib/catalog/feature-flag", () => ({
  shouldOfferExternalCatalog: () => shouldOfferExternalCatalog(),
  isExternalProviderAvailable: (provider: "tmdb" | "openlibrary" | "rawg") =>
    isExternalProviderAvailable(provider),
}));

const isCatalogAdminConfigured = vi.fn();
vi.mock("@/lib/catalog/admin-client", () => ({
  isCatalogAdminConfigured: () => isCatalogAdminConfigured(),
}));

const materialize = vi.fn();
vi.mock("@/lib/catalog/server-materializer", () => ({
  createServerCatalogMaterializer: () => ({ materialize }),
}));

const addListItem = vi.fn();
vi.mock("@/lib/supabase/lists", () => ({
  addListItem: (input: unknown) => addListItem(input),
}));

import { saveDiscoveredTitleAction } from "@/app/discovery/actions";
import { initialDiscoverySaveState } from "@/app/discovery/save-form";
import {
  AMBIGUOUS_MATERIALIZE_MESSAGE,
  CatalogProviderError,
} from "@/lib/catalog/materialize";

const LIST_ID = "3f1c2b8e-4d5a-4f6b-9c7d-8e9f0a1b2c3d";

const COMPLETE_PROFILE = {
  username: "jamie",
  displayName: "Jamie",
} as unknown as NonNullable<Awaited<ReturnType<typeof getCurrentProfile>>>;

function form(extra: Record<string, string> = {}): FormData {
  const fd = new FormData();
  fd.set("provider", "rawg");
  fd.set("kind", "game");
  fd.set("externalId", "3498");
  fd.set("listId", LIST_ID);
  fd.set("returnTo", "/explore?kind=game");
  for (const [k, v] of Object.entries(extra)) fd.set(k, v);
  return fd;
}

function save(fd: FormData = form()) {
  return saveDiscoveredTitleAction(initialDiscoverySaveState, fd);
}

describe("saveDiscoveredTitleAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    shouldOfferExternalCatalog.mockReturnValue(true);
    isExternalProviderAvailable.mockReturnValue(true);
    getCurrentUser.mockResolvedValue({ id: "user-1" });
    getCurrentProfile.mockResolvedValue(COMPLETE_PROFILE);
    isCatalogAdminConfigured.mockReturnValue(true);
    materialize.mockResolvedValue({ slug: "hades", resolution: "created" });
    addListItem.mockResolvedValue({
      status: "success",
      slug: "favorite-games",
      listId: LIST_ID,
      alreadyPresent: false,
    });
  });

  it("materializes then adds to the list, revalidating both pages", async () => {
    const result = await save();

    expect(result).toEqual({
      status: "success",
      mediaSlug: "hades",
      listSlug: "favorite-games",
      listId: LIST_ID,
      alreadyPresent: false,
    });
    expect(materialize).toHaveBeenCalledWith({
      provider: "rawg",
      kind: "game",
      externalId: "3498",
    });
    expect(addListItem).toHaveBeenCalledWith({
      listId: LIST_ID,
      mediaSlug: "hades",
    });
    expect(revalidatePath).toHaveBeenCalledWith("/list/favorite-games");
    expect(revalidatePath).toHaveBeenCalledWith("/title/hades");
  });

  it("reports an already-saved title without treating it as an error", async () => {
    addListItem.mockResolvedValue({
      status: "success",
      slug: "favorite-games",
      listId: LIST_ID,
      alreadyPresent: true,
    });

    const result = await save();

    expect(result.status).toBe("success");
    expect(result.alreadyPresent).toBe(true);
  });

  it("is unavailable with no write when the external catalog is off", async () => {
    shouldOfferExternalCatalog.mockReturnValue(false);

    const result = await save();

    expect(result.status).toBe("unavailable");
    expect(getCurrentUser).not.toHaveBeenCalled();
    expect(materialize).not.toHaveBeenCalled();
    expect(addListItem).not.toHaveBeenCalled();
  });

  it("is unavailable without leaking why when the provider is disabled", async () => {
    isExternalProviderAvailable.mockReturnValue(false);

    const result = await save();

    expect(result.status).toBe("unavailable");
    expect(result.message).not.toMatch(/rawg|licen[cs]|legal/i);
    expect(materialize).not.toHaveBeenCalled();
  });

  it("sends signed-out viewers to sign in with a safe return path", async () => {
    getCurrentUser.mockResolvedValue(null);

    const result = await save();

    expect(result.status).toBe("unauthenticated");
    expect(result.redirectTo).toBe(
      `/auth/sign-in?returnTo=${encodeURIComponent("/explore?kind=game")}`,
    );
    expect(materialize).not.toHaveBeenCalled();
  });

  it("drops an off-site return path", async () => {
    getCurrentUser.mockResolvedValue(null);

    const result = await save(form({ returnTo: "https://evil.example/x" }));

    expect(result.redirectTo).toBe("/auth/sign-in");
  });

  it("sends viewers with an incomplete profile to onboarding", async () => {
    getCurrentProfile.mockResolvedValue(null);

    const result = await save();

    expect(result.status).toBe("onboarding");
    expect(result.redirectTo).toMatch(/^\/onboarding/);
    expect(materialize).not.toHaveBeenCalled();
  });

  it.each([
    ["an unknown provider", { provider: "imdb" }],
    ["a mismatched kind", { kind: "book" }],
    ["a non-uuid list id", { listId: "not-a-uuid" }],
  ])("rejects %s before any write", async (_label, extra) => {
    const result = await save(form(extra));

    expect(result.status).toBe("error");
    expect(materialize).not.toHaveBeenCalled();
    expect(addListItem).not.toHaveBeenCalled();
  });

  it("does not add to the list when materialization is ambiguous", async () => {
    materialize.mockRejectedValue(
      new CatalogProviderError(AMBIGUOUS_MATERIALIZE_MESSAGE, {
        provider: "rawg",
        operation: "materialize",
        category: "validation",
      }),
    );

    const result = await save();

    expect(result.status).toBe("error");
    expect(result.message).toMatch(/couldn't confirm/i);
    expect(addListItem).not.toHaveBeenCalled();
  });

  it("maps a provider failure to a safe retry message", async () => {
    materialize.mockRejectedValue(new Error("socket hang up"));

    const result = await save();

    expect(result.status).toBe("error");
    expect(result.message).not.toMatch(/socket/i);
    expect(addListItem).not.toHaveBeenCalled();
  });

  it("surfaces a list write failure without revalidating", async () => {
    addListItem.mockResolvedValue({
      status: "error",
      message: "We couldn't update that list.",
    });

    const result = await save();

    expect(result).toEqual({
      status: "error",
      message: "We couldn't update that list.",
      mediaSlug: "hades",
    });
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
