import { afterEach, describe, expect, it, vi } from "vitest";
import { initialCreateListFormState } from "@/app/lists/list-form";
import { initialDiscoverySaveState } from "@/app/discovery/save-form";
import {
  createAndSaveDiscoveredTitle,
  saveDiscoveredTitle,
} from "./create-save-client";

function form() {
  const data = new FormData();
  data.set("title", "First shelf");
  data.set("provider", "tmdb");
  data.set("kind", "movie");
  data.set("externalId", "999101");
  return data;
}

describe("discovery save-only client transport", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("returns the server-confirmed duplicate result without an RSC stream", async () => {
    const state = {
      status: "success",
      listId: "existing-list",
      alreadyPresent: true,
    };
    const fetch = vi.fn().mockResolvedValue(Response.json(state));
    vi.stubGlobal("fetch", fetch);
    const data = form();
    data.set("listId", "existing-list");
    data.set("intent", "create");
    expect(await saveDiscoveredTitle(initialDiscoverySaveState, data)).toEqual(
      state,
    );
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
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toMatchObject({
      intent: "save",
      listId: "existing-list",
    });
  });

  it("retains the server's session-expiry continuation", async () => {
    const state = {
      status: "unauthenticated",
      redirectTo: "/auth/sign-in?returnTo=%2Fexplore",
    };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(Response.json(state, { status: 401 })),
    );
    expect(
      await saveDiscoveredTitle(initialDiscoverySaveState, form()),
    ).toEqual(state);
  });

  it("does not automatically replay a failed save or expose private errors", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(
        Response.json({ message: "private details" }, { status: 500 }),
      );
    vi.stubGlobal("fetch", fetch);
    await expect(
      saveDiscoveredTitle(initialDiscoverySaveState, form()),
    ).rejects.toThrow("Save failed");
    expect(fetch).toHaveBeenCalledOnce();
  });
});

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
