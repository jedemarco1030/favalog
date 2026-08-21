import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Server DAL contract for the favorite WRITE path (`setFavorite`).
 *
 * The read paths are RLS-scoped Supabase queries verified through the pure
 * view-model unit tests and Playwright; here we prove the write path's
 * authoritative gates and its defensive success contract with the Supabase
 * client, auth DAL, and revalidation all mocked. In particular a MALFORMED RPC
 * success (missing identifiers or a non-boolean resulting state) must be
 * treated as a failure — never a false success.
 */

// `favorites.ts` is a server-only module; the Vitest config aliases
// `server-only` to an empty stub so it imports cleanly under test.
const isSupabaseConfigured = vi.fn();
vi.mock("./env", () => ({
  isSupabaseConfigured: () => isSupabaseConfigured(),
}));

const rpc = vi.fn();
vi.mock("./server", () => ({
  createClient: async () => ({ rpc: (...args: unknown[]) => rpc(...args) }),
}));

const getCurrentUser = vi.fn();
const getCurrentProfile = vi.fn();
vi.mock("@/lib/auth/data", () => ({
  getCurrentUser: () => getCurrentUser(),
  getCurrentProfile: () => getCurrentProfile(),
}));

const isProfileComplete = vi.fn();
vi.mock("@/lib/auth/profile", () => ({
  isProfileComplete: (...args: unknown[]) => isProfileComplete(...args),
}));

const revalidatePath = vi.fn();
vi.mock("next/cache", () => ({
  revalidatePath: (...args: unknown[]) => revalidatePath(...args),
}));

import { setFavorite } from "./favorites";

const OK_PROFILE = { id: "u1", username: "alice" };

function signedInOnboarded() {
  isSupabaseConfigured.mockReturnValue(true);
  getCurrentUser.mockResolvedValue({ id: "u1" });
  getCurrentProfile.mockResolvedValue(OK_PROFILE);
  isProfileComplete.mockReturnValue(true);
}

describe("setFavorite", () => {
  beforeEach(() => {
    isSupabaseConfigured.mockReset();
    rpc.mockReset();
    getCurrentUser.mockReset();
    getCurrentProfile.mockReset();
    isProfileComplete.mockReset();
    revalidatePath.mockReset();
  });

  it("returns unavailable when Supabase is not configured", async () => {
    isSupabaseConfigured.mockReturnValue(false);
    const result = await setFavorite({
      mediaSlug: "afterglow",
      isFavorite: true,
    });
    expect(result.status).toBe("unavailable");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("returns unauthenticated when there is no session", async () => {
    isSupabaseConfigured.mockReturnValue(true);
    getCurrentUser.mockResolvedValue(null);
    const result = await setFavorite({
      mediaSlug: "afterglow",
      isFavorite: true,
    });
    expect(result.status).toBe("unauthenticated");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("returns incomplete-profile when onboarding isn't finished", async () => {
    isSupabaseConfigured.mockReturnValue(true);
    getCurrentUser.mockResolvedValue({ id: "u1" });
    getCurrentProfile.mockResolvedValue(OK_PROFILE);
    isProfileComplete.mockReturnValue(false);
    const result = await setFavorite({
      mediaSlug: "afterglow",
      isFavorite: true,
    });
    expect(result.status).toBe("incomplete-profile");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("returns invalid for a blank media slug without calling the RPC", async () => {
    signedInOnboarded();
    const result = await setFavorite({ mediaSlug: "   ", isFavorite: true });
    expect(result.status).toBe("invalid");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("maps an RPC error to a safe error message", async () => {
    signedInOnboarded();
    rpc.mockResolvedValue({ data: null, error: { code: "P0002" } });
    const result = await setFavorite({
      mediaSlug: "afterglow",
      isFavorite: true,
    });
    expect(result.status).toBe("error");
    if (result.status === "error") {
      expect(result.message).toMatch(/find that title/i);
    }
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("returns the actual resulting state on success and revalidates", async () => {
    signedInOnboarded();
    rpc.mockResolvedValue({
      data: {
        favorite_id: "f1",
        media_id: "m1",
        slug: "afterglow",
        position: 0,
        is_favorite: true,
        changed: true,
      },
      error: null,
    });

    const result = await setFavorite({
      mediaSlug: "afterglow",
      isFavorite: true,
    });

    expect(rpc).toHaveBeenCalledWith("set_favorite", {
      p_media_slug: "afterglow",
      p_is_favorite: true,
    });
    expect(result).toEqual({
      status: "success",
      mediaId: "m1",
      slug: "afterglow",
      isFavorite: true,
      position: 0,
      changed: true,
    });
    // Title page + the owner's own profile are revalidated (username from the
    // auth DAL, never the client).
    expect(revalidatePath).toHaveBeenCalledWith("/title/afterglow");
    expect(revalidatePath).toHaveBeenCalledWith("/profile/alice");
  });

  it("reports the removed state (position null) on a successful removal", async () => {
    signedInOnboarded();
    rpc.mockResolvedValue({
      data: {
        favorite_id: null,
        media_id: "m1",
        slug: "afterglow",
        position: null,
        is_favorite: false,
        changed: true,
      },
      error: null,
    });

    const result = await setFavorite({
      mediaSlug: "afterglow",
      isFavorite: false,
    });
    expect(result).toEqual({
      status: "success",
      mediaId: "m1",
      slug: "afterglow",
      isFavorite: false,
      position: null,
      changed: true,
    });
  });

  it("treats a malformed success (missing identifiers) as an error", async () => {
    signedInOnboarded();
    rpc.mockResolvedValue({
      data: { is_favorite: true },
      error: null,
    });
    const result = await setFavorite({
      mediaSlug: "afterglow",
      isFavorite: true,
    });
    expect(result.status).toBe("error");
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("treats a success without a boolean resulting state as an error", async () => {
    signedInOnboarded();
    rpc.mockResolvedValue({
      data: { media_id: "m1", slug: "afterglow" },
      error: null,
    });
    const result = await setFavorite({
      mediaSlug: "afterglow",
      isFavorite: true,
    });
    expect(result.status).toBe("error");
  });
});
