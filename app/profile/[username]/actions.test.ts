import { beforeEach, describe, expect, it, vi } from "vitest";

const setFollow = vi.fn();
vi.mock("@/lib/supabase/follows", () => ({
  setFollow: (...args: unknown[]) => setFollow(...args),
}));

import { setFollowAction } from "@/app/profile/[username]/actions";
import { initialFollowFormState } from "@/app/profile/[username]/follow-form";

function followFormData(extra: Record<string, string> = {}): FormData {
  const fd = new FormData();
  fd.set("username", "bob_test");
  fd.set("isFollow", "true");
  for (const [key, value] of Object.entries(extra)) fd.set(key, value);
  return fd;
}

describe("setFollowAction", () => {
  beforeEach(() => setFollow.mockReset());

  it("returns the server's actual resulting state on success", async () => {
    setFollow.mockResolvedValue({
      status: "success",
      targetUserId: "u2",
      targetUsername: "bob_test",
      isFollowing: true,
      changed: true,
    });

    const result = await setFollowAction(
      initialFollowFormState,
      followFormData(),
    );

    expect(setFollow).toHaveBeenCalledWith({
      username: "bob_test",
      isFollow: true,
    });
    expect(result).toEqual({
      status: "success",
      isFollowing: true,
      username: "bob_test",
    });
  });

  it("routes an unauthenticated caller through the safe sign-in returnTo flow", async () => {
    setFollow.mockResolvedValue({ status: "unauthenticated" });

    const result = await setFollowAction(
      initialFollowFormState,
      followFormData({ returnTo: "/profile/bob_test" }),
    );

    expect(result.status).toBe("unauthenticated");
    expect(result.redirectTo).toBe(
      "/auth/sign-in?returnTo=%2Fprofile%2Fbob_test",
    );
  });

  it("routes an incomplete profile to onboarding", async () => {
    setFollow.mockResolvedValue({ status: "incomplete-profile" });

    const result = await setFollowAction(
      initialFollowFormState,
      followFormData({ returnTo: "/profile/bob_test" }),
    );

    expect(result.status).toBe("onboarding");
    expect(result.redirectTo).toBe(
      "/onboarding?returnTo=%2Fprofile%2Fbob_test",
    );
  });

  it("ignores an unsafe cross-origin returnTo and falls back to profile path", async () => {
    setFollow.mockResolvedValue({ status: "unauthenticated" });

    const result = await setFollowAction(
      initialFollowFormState,
      followFormData({ returnTo: "https://evil.example.com/steal" }),
    );

    expect(result.redirectTo).toBe(
      "/auth/sign-in?returnTo=%2Fprofile%2Fbob_test",
    );
  });

  it("surfaces a safe error message without redirecting", async () => {
    setFollow.mockResolvedValue({
      status: "error",
      message: "We couldn't update this follow right now.",
    });

    const result = await setFollowAction(
      initialFollowFormState,
      followFormData(),
    );

    expect(result.status).toBe("error");
    expect(result.message).toBe("We couldn't update this follow right now.");
    expect(result.redirectTo).toBeUndefined();
  });

  it("surfaces an unavailable environment", async () => {
    setFollow.mockResolvedValue({ status: "unavailable" });

    const result = await setFollowAction(
      initialFollowFormState,
      followFormData(),
    );

    expect(result.status).toBe("unavailable");
  });

  it("maps an invalid write result to a safe error state", async () => {
    setFollow.mockResolvedValue({
      status: "invalid",
      message: "Please provide a valid username.",
    });

    const result = await setFollowAction(
      initialFollowFormState,
      followFormData(),
    );

    expect(result.status).toBe("error");
    expect(result.message).toBe("Please provide a valid username.");
  });
});
