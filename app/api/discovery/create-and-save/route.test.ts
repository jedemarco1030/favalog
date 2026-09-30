import { beforeEach, describe, expect, it, vi } from "vitest";

const getCurrentUser = vi.fn();
const createAndSave = vi.fn();
vi.mock("@/lib/auth/data", () => ({ getCurrentUser: () => getCurrentUser() }));
vi.mock("@/app/discovery/actions", () => ({
  createAndSaveDiscoveredTitleAction: (state: unknown, data: FormData) =>
    createAndSave(state, data),
}));

import { POST } from "./route";

const ORIGIN = "https://favalog.example";
const input = {
  title: "First shelf",
  visibility: "private",
  provider: "tmdb",
  kind: "movie",
  externalId: "999101",
  returnTo: "/explore?type=movie",
};

function request(body: unknown = input, headers: Record<string, string> = {}) {
  return new Request(`${ORIGIN}/api/discovery/create-and-save`, {
    method: "POST",
    headers: { origin: ORIGIN, "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

describe("discovery create-save JSON boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCurrentUser.mockResolvedValue({ id: "authenticated-user" });
    createAndSave.mockResolvedValue({
      status: "success",
      listId: "created-list",
      save: {
        status: "success",
        listId: "created-list",
        mediaSlug: "fixture-lantern-coast",
      },
    });
  });

  it.each(["https://untrusted.example", "null", ""])(
    "rejects origin %s before authentication or writes",
    async (origin) => {
      const response = await POST(request(input, { origin }));
      expect(response.status).toBe(403);
      expect(getCurrentUser).not.toHaveBeenCalled();
      expect(createAndSave).not.toHaveBeenCalled();
    },
  );

  it("requires JSON, not a cross-site form payload", async () => {
    const response = await POST(
      request(input, { "content-type": "text/plain" }),
    );
    expect(response.status).toBe(415);
    expect(createAndSave).not.toHaveBeenCalled();
  });

  it.each([
    null,
    [],
    { ...input, title: 42 },
    { ...input, returnTo: "a".repeat(1025) },
    { ...input, title: "a".repeat(5000) },
  ])("rejects malformed or oversized bodies without writes", async (body) => {
    const response = await POST(request(body));
    expect(response.status).toBe(400);
    expect(createAndSave).not.toHaveBeenCalled();
  });

  it("re-validates auth and preserves only a safe same-card sign-in continuation", async () => {
    getCurrentUser.mockResolvedValue(null);
    const response = await POST(
      request({ ...input, returnTo: "https://untrusted.example/path" }),
    );
    expect(response.status).toBe(401);
    const result = await response.json();
    const target = new URL(result.redirectTo, ORIGIN);
    expect(target.pathname).toBe("/auth/sign-in");
    expect(target.searchParams.get("returnTo")).toBe(
      "/explore?save=tmdb%3Amovie%3A999101",
    );
    expect(createAndSave).not.toHaveBeenCalled();
  });

  it("delegates once with allow-listed fields and no client ownership or media metadata", async () => {
    const response = await POST(
      request({
        ...input,
        userId: "other-owner",
        listId: "other-list",
        mediaSlug: "untrusted-title",
      }),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(getCurrentUser).toHaveBeenCalledOnce();
    expect(createAndSave).toHaveBeenCalledOnce();
    const data = createAndSave.mock.calls[0][1] as FormData;
    expect([...data.keys()]).toEqual([
      "title",
      "visibility",
      "provider",
      "kind",
      "externalId",
      "returnTo",
    ]);
    expect(data.get("returnTo")).toBe(
      "/explore?type=movie&save=tmdb%3Amovie%3A999101",
    );
    expect(await response.json()).toMatchObject({
      status: "success",
      listId: "created-list",
      save: { status: "success", mediaSlug: "fixture-lantern-coast" },
    });
  });

  it("retains the created list and failed-save state for a save-only retry", async () => {
    const partial = {
      status: "success",
      listId: "created-list",
      save: { status: "error", message: "Try again." },
    };
    createAndSave.mockResolvedValue(partial);
    expect(await (await POST(request())).json()).toEqual(partial);
    expect(createAndSave).toHaveBeenCalledOnce();
  });

  it("does not leak internal failures", async () => {
    createAndSave.mockRejectedValue(new Error("private database details"));
    const response = await POST(request());
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      status: "error",
      message: "We couldn't create that list just now.",
    });
  });
});
