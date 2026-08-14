import { describe, expect, it } from "vitest";

import {
  GENERIC_ADD_ITEM_ERROR,
  GENERIC_CREATE_LIST_ERROR,
  GENERIC_REMOVE_ITEM_ERROR,
  mapAddItemError,
  mapCreateListError,
  mapRemoveItemError,
} from "./list-errors";

describe("safe list-error mapping", () => {
  it("maps the auth error (by code and by message) to a sign-in prompt", () => {
    expect(mapCreateListError({ code: "28000" })).toBe(
      "Please sign in to continue.",
    );
    expect(mapAddItemError({ message: "authentication required" })).toBe(
      "Please sign in to continue.",
    );
  });

  it("maps invalid list-detail errors to a single safe message", () => {
    const expected = "Please check the list details and try again.";
    expect(mapCreateListError({ code: "22023" })).toBe(expected);
    expect(mapCreateListError({ message: "invalid list visibility: x" })).toBe(
      expected,
    );
    expect(mapCreateListError({ message: "invalid list title" })).toBe(
      expected,
    );
  });

  it("maps an RLS/privilege denial without leaking detail", () => {
    expect(
      mapAddItemError({ code: "42501", message: "permission denied" }),
    ).toBe("You don't have permission to do that.");
  });

  it("phrases the not-found case per write path", () => {
    // A missing catalog title on create vs a missing/foreign list on add/remove.
    expect(mapCreateListError({ code: "P0002" })).toMatch(/find that title/i);
    expect(mapAddItemError({ message: "unknown list: x" })).toMatch(
      /find that list/i,
    );
    expect(mapRemoveItemError({ message: "unknown media slug: x" })).toMatch(
      /find that list/i,
    );
  });

  it("falls back to a safe generic message per write path", () => {
    expect(mapCreateListError({ code: "XX000", message: "boom" })).toBe(
      GENERIC_CREATE_LIST_ERROR,
    );
    expect(mapAddItemError({})).toBe(GENERIC_ADD_ITEM_ERROR);
    expect(mapRemoveItemError({})).toBe(GENERIC_REMOVE_ITEM_ERROR);
  });

  it("never returns raw database detail", () => {
    const raw =
      'duplicate key value violates unique constraint "lists_slug_global_key"';
    const mapped = mapAddItemError({ code: "23505", message: raw });
    expect(mapped).not.toContain(raw);
    expect(mapped).toBe(GENERIC_ADD_ITEM_ERROR);
  });
});
