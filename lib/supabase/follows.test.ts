import { beforeEach, describe, expect, it, vi } from "vitest";

const revalidatePath = vi.fn();
vi.mock("next/cache", () => ({
  revalidatePath: (...args: unknown[]) => revalidatePath(...args),
}));

const isSupabaseConfigured = vi.fn();
vi.mock("./env", () => ({
  isSupabaseConfigured: () => isSupabaseConfigured(),
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

const rpc = vi.fn();
const from = vi.fn();
vi.mock("./server", () => ({
  createClient: async () => ({
    rpc: (...args: unknown[]) => rpc(...args),
    from: (...args: unknown[]) => from(...args),
  }),
}));

import { getProfileSocial, setFollow } from "./follows";

const authedUser = { id: "u_caller", email: "caller@example.com" };
const authedProfile = {
  id: "u_caller",
  username: "caller_user",
  displayName: "Caller User",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("setFollow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isSupabaseConfigured.mockReturnValue(true);
    getCurrentUser.mockResolvedValue(authedUser);
    getCurrentProfile.mockResolvedValue(authedProfile);
    isProfileComplete.mockReturnValue(true);
  });

  it("returns unavailable when Supabase is not configured", async () => {
    isSupabaseConfigured.mockReturnValue(false);

    const result = await setFollow({ username: "target_user", isFollow: true });
    expect(result).toEqual({ status: "unavailable" });
  });

  it("returns unauthenticated when no session exists", async () => {
    getCurrentUser.mockResolvedValue(null);

    const result = await setFollow({ username: "target_user", isFollow: true });
    expect(result).toEqual({ status: "unauthenticated" });
  });

  it("returns incomplete-profile when onboarding is not finished", async () => {
    isProfileComplete.mockReturnValue(false);

    const result = await setFollow({ username: "target_user", isFollow: true });
    expect(result).toEqual({ status: "incomplete-profile" });
  });

  it("returns invalid on malformed input", async () => {
    const result = await setFollow({ username: "ab", isFollow: true });
    expect(result.status).toBe("invalid");
  });

  it("calls set_follow RPC and revalidates paths on success", async () => {
    rpc.mockResolvedValue({
      data: {
        target_username: "target_user",
        target_user_id: "u_target",
        is_following: true,
        changed: true,
      },
      error: null,
    });

    const result = await setFollow({ username: "target_user", isFollow: true });

    expect(rpc).toHaveBeenCalledWith("set_follow", {
      p_target_username: "target_user",
      p_is_follow: true,
    });
    expect(revalidatePath).toHaveBeenCalledWith("/profile/target_user");
    expect(revalidatePath).toHaveBeenCalledWith("/profile/caller_user");
    expect(revalidatePath).toHaveBeenCalledWith("/lists");
    expect(result).toEqual({
      status: "success",
      targetUsername: "target_user",
      targetUserId: "u_target",
      isFollowing: true,
      changed: true,
    });
  });

  it("maps database errors safely", async () => {
    rpc.mockResolvedValue({
      data: null,
      error: { code: "22023", message: "cannot follow self" },
    });

    const result = await setFollow({ username: "caller_user", isFollow: true });
    expect(result).toEqual({
      status: "error",
      message: "You cannot follow your own profile.",
    });
  });
});

describe("getProfileSocial", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isSupabaseConfigured.mockReturnValue(true);
  });

  it("returns unavailable when Supabase is not configured", async () => {
    isSupabaseConfigured.mockReturnValue(false);

    const result = await getProfileSocial("u_target", "target_user");
    expect(result).toEqual({ status: "unavailable" });
  });

  it("returns follower count, following count, and signed-out state when viewer is absent", async () => {
    from.mockImplementation((table: string) => {
      if (table === "follows") {
        return {
          select: () => ({
            eq: (col: string) => {
              if (col === "following_id")
                return Promise.resolve({ count: 5, error: null });
              if (col === "follower_id")
                return Promise.resolve({ count: 12, error: null });
              return Promise.resolve({ count: 0, error: null });
            },
          }),
        };
      }
      return {};
    });

    const result = await getProfileSocial("u_target", "target_user", null);
    expect(result).toEqual({
      status: "ok",
      counts: { followerCount: 5, followingCount: 12 },
      viewerState: { kind: "signed-out" },
    });
  });

  it("returns owner state when viewer is target profile owner", async () => {
    from.mockImplementation((table: string) => {
      if (table === "follows") {
        return {
          select: () => ({
            eq: (col: string) => {
              if (col === "following_id")
                return Promise.resolve({ count: 3, error: null });
              if (col === "follower_id")
                return Promise.resolve({ count: 4, error: null });
              return Promise.resolve({ count: 0, error: null });
            },
          }),
        };
      }
      return {};
    });

    const result = await getProfileSocial("u_owner", "owner_user", "u_owner");
    expect(result).toEqual({
      status: "ok",
      counts: { followerCount: 3, followingCount: 4 },
      viewerState: { kind: "owner" },
    });
  });

  it("returns viewer relationship state when viewer is another user", async () => {
    from.mockImplementation((table: string) => {
      if (table === "follows") {
        return {
          select: (
            _query?: string,
            opts?: { count?: string; head?: boolean },
          ) => {
            if (opts?.count === "exact") {
              return {
                eq: (col: string) => {
                  if (col === "following_id")
                    return Promise.resolve({ count: 7, error: null });
                  if (col === "follower_id")
                    return Promise.resolve({ count: 1, error: null });
                  return Promise.resolve({ count: 0, error: null });
                },
              };
            }
            return {
              eq: () => ({
                eq: () => ({
                  maybeSingle: () =>
                    Promise.resolve({
                      data: { created_at: "2026-01-01" },
                      error: null,
                    }),
                }),
              }),
            };
          },
        };
      }
      return {};
    });

    const result = await getProfileSocial(
      "u_target",
      "target_user",
      "u_viewer",
    );
    expect(result).toEqual({
      status: "ok",
      counts: { followerCount: 7, followingCount: 1 },
      viewerState: { kind: "viewer", isFollowing: true },
    });
  });

  it("returns error status on query failure", async () => {
    from.mockImplementation(() => ({
      select: () => ({
        eq: () =>
          Promise.resolve({ count: null, error: { message: "DB down" } }),
      }),
    }));

    const result = await getProfileSocial("u_target", "target_user", null);
    expect(result).toEqual({ status: "error" });
  });
});
