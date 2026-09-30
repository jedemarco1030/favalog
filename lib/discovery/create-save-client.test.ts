import { afterEach, describe, expect, it, vi } from "vitest";
import { initialCreateListFormState } from "@/app/lists/list-form";
import { createAndSaveDiscoveredTitle } from "./create-save-client";

function form() {
  const data = new FormData();
  data.set("title", "First shelf");
  data.set("provider", "tmdb");
  data.set("kind", "movie");
  data.set("externalId", "999101");
  return data;
}

describe("discovery create-save client transport", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("returns server-confirmed JSON without waiting for an RSC response", async () => {
    const state = {
      status: "success",
      listId: "one-list",
      save: { status: "success", mediaSlug: "fixture-lantern-coast" },
    };
    const fetch = vi.fn().mockResolvedValue(Response.json(state));
    vi.stubGlobal("fetch", fetch);
    expect(
      await createAndSaveDiscoveredTitle(initialCreateListFormState, form()),
    ).toEqual(state);
    expect(fetch).toHaveBeenCalledOnce();
    expect(fetch).toHaveBeenCalledWith(
      "/api/discovery/create-and-save",
      expect.objectContaining({
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
      }),
    );
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual(
      Object.fromEntries(form()),
    );
  });

  it("retains a safe sign-in continuation after session expiry", async () => {
    const state = {
      status: "unauthenticated",
      redirectTo: "/auth/sign-in?returnTo=%2Fexplore",
    };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(Response.json(state, { status: 401 })),
    );
    expect(
      await createAndSaveDiscoveredTitle(initialCreateListFormState, form()),
    ).toEqual(state);
  });

  it("retains partial success so the dialog can retry only saving", async () => {
    const state = {
      status: "success",
      listId: "created-list",
      save: { status: "error", message: "Try again." },
    };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(state)));
    expect(
      await createAndSaveDiscoveredTitle(initialCreateListFormState, form()),
    ).toEqual(state);
  });

  it("never automatically repeats a failed creation request or leaks its error body", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(
        Response.json({ message: "private database details" }, { status: 500 }),
      );
    vi.stubGlobal("fetch", fetch);
    await expect(
      createAndSaveDiscoveredTitle(initialCreateListFormState, form()),
    ).rejects.toThrow("Create and save failed");
    expect(fetch).toHaveBeenCalledOnce();
  });
});
