import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `"use server"` contract for `setFavoriteAction`.
 *
 * The action is a thin, authoritative gate in front of the `setFavorite` write
 * path. It must return the ACTUAL server-returned resulting state on success,
 * route signed-out / expired sessions through the safe sign-in `returnTo` flow
 * and an incomplete profile to onboarding (server-built, validated targets),
 * and never surface a raw error. All of `setFavorite`'s branches are mocked.
 */

const setFavorite = vi.fn();
vi.mock("@/lib/supabase/favorites", () => ({
  setFavorite: (...args: unknown[]) => setFavorite(...args),
}));

// `actions.ts` also imports the diary/log write path for `logTitleAction`;
// neutralize those server-only modules so importing the action module is safe.
vi.mock("@/lib/supabase/log", () => ({ logMedia: vi.fn() }));
vi.mock("@/lib/auth/data", () => ({
  getCurrentUser: vi.fn(),
  getCurrentProfile: vi.fn(),
}));
vi.mock("@/lib/auth/profile", () => ({ isProfileComplete: vi.fn() }));

import { setFavoriteAction } from "@/app/title/[slug]/actions";
import { initialFavoriteFormState } from "@/app/title/[slug]/favorite-form";

function favoriteFormData(extra: Record<string, string> = {}): FormData {
  const fd = new FormData();
  fd.set("mediaSlug", "afterglow");
  fd.set("isFavorite", "true");
  for (const [key, value] of Object.entries(extra)) fd.set(key, value);
  return fd;
}

describe("setFavoriteAction", () => {
  beforeEach(() => setFavorite.mockReset());

  it("returns the server's actual resulting state on success", async () => {
    setFavorite.mockResolvedValue({
      status: "success",
      mediaId: "m1",
      slug: "afterglow",
      isFavorite: true,
      position: 0,
      changed: true,
    });

    const result = await setFavoriteAction(
      initialFavoriteFormState,
      favoriteFormData(),
    );

    expect(setFavorite).toHaveBeenCalledWith({
      mediaSlug: "afterglow",
      isFavorite: true,
    });
    expect(result).toEqual({
      status: "success",
      isFavorite: true,
      slug: "afterglow",
    });
  });

  it("routes an unauthenticated caller through the safe sign-in returnTo flow", async () => {
    setFavorite.mockResolvedValue({ status: "unauthenticated" });

    const result = await setFavoriteAction(
      initialFavoriteFormState,
      favoriteFormData({ returnTo: "/title/afterglow" }),
    );

    expect(result.status).toBe("unauthenticated");
    expect(result.redirectTo).toBe(
      "/auth/sign-in?returnTo=%2Ftitle%2Fafterglow",
    );
  });

  it("routes an incomplete profile to onboarding", async () => {
    setFavorite.mockResolvedValue({ status: "incomplete-profile" });

    const result = await setFavoriteAction(
      initialFavoriteFormState,
      favoriteFormData({ returnTo: "/title/afterglow" }),
    );

    expect(result.status).toBe("onboarding");
    expect(result.redirectTo).toBe("/onboarding?returnTo=%2Ftitle%2Fafterglow");
  });

  it("ignores an unsafe cross-origin returnTo and falls back to the title path", async () => {
    setFavorite.mockResolvedValue({ status: "unauthenticated" });

    const result = await setFavoriteAction(
      initialFavoriteFormState,
      favoriteFormData({ returnTo: "https://evil.example.com/steal" }),
    );

    expect(result.redirectTo).toBe(
      "/auth/sign-in?returnTo=%2Ftitle%2Fafterglow",
    );
  });

  it("surfaces a safe error message without redirecting", async () => {
    setFavorite.mockResolvedValue({
      status: "error",
      message: "We couldn't update your favorites just now.",
    });

    const result = await setFavoriteAction(
      initialFavoriteFormState,
      favoriteFormData(),
    );

    expect(result.status).toBe("error");
    expect(result.redirectTo).toBeUndefined();
  });

  it("surfaces an unavailable environment", async () => {
    setFavorite.mockResolvedValue({ status: "unavailable" });

    const result = await setFavoriteAction(
      initialFavoriteFormState,
      favoriteFormData(),
    );

    expect(result.status).toBe("unavailable");
  });

  it("maps an invalid write result to a safe error state", async () => {
    setFavorite.mockResolvedValue({ status: "invalid", message: "bad" });

    const result = await setFavoriteAction(
      initialFavoriteFormState,
      favoriteFormData(),
    );

    expect(result.status).toBe("error");
  });
});
