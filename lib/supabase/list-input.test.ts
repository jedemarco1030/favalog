import { describe, expect, it } from "vitest";

import {
  MAX_LIST_DESCRIPTION,
  MAX_LIST_TITLE,
  isUuid,
  normalizeVisibility,
  validateCreateListInput,
  validateDeleteListInput,
  validateListItemInput,
  validateUpdateListInput,
} from "./list-input";

const UUID = "11111111-1111-1111-1111-111111111111";

describe("normalizeVisibility", () => {
  it("accepts only the creatable values", () => {
    expect(normalizeVisibility("public")).toBe("public");
    expect(normalizeVisibility("private")).toBe("private");
  });

  it("rejects followers and any unknown value", () => {
    expect(normalizeVisibility("followers")).toBeNull();
    expect(normalizeVisibility("unlisted")).toBeNull();
    expect(normalizeVisibility("")).toBeNull();
    expect(normalizeVisibility(null)).toBeNull();
    expect(normalizeVisibility(undefined)).toBeNull();
  });
});

describe("validateCreateListInput", () => {
  it("normalizes a valid list (trimming, defaults)", () => {
    const result = validateCreateListInput({
      title: "  My Films  ",
      description: "  A canon.  ",
      isRanked: true,
      visibility: "private",
      mediaSlug: "  afterglow  ",
    });
    expect(result.ok).toBe(true);
    expect(result.value).toEqual({
      title: "My Films",
      description: "A canon.",
      isRanked: true,
      visibility: "private",
      mediaSlug: "afterglow",
    });
  });

  it("defaults visibility to public and description/mediaSlug to null when omitted", () => {
    const result = validateCreateListInput({ title: "Just a title" });
    expect(result.ok).toBe(true);
    expect(result.value).toMatchObject({
      visibility: "public",
      description: null,
      mediaSlug: null,
      isRanked: false,
    });
  });

  it("requires a non-empty title", () => {
    const result = validateCreateListInput({ title: "   " });
    expect(result.ok).toBe(false);
    expect(result.errors.title).toBeTruthy();
    expect(result.value).toBeUndefined();
  });

  it("rejects an over-long title and description", () => {
    const long = validateCreateListInput({
      title: "x".repeat(MAX_LIST_TITLE + 1),
    });
    expect(long.ok).toBe(false);
    expect(long.errors.title).toBeTruthy();

    const longDesc = validateCreateListInput({
      title: "ok",
      description: "y".repeat(MAX_LIST_DESCRIPTION + 1),
    });
    expect(longDesc.ok).toBe(false);
    expect(longDesc.errors.description).toBeTruthy();
  });

  it("rejects an explicit unknown visibility rather than coercing it", () => {
    const result = validateCreateListInput({
      title: "ok",
      visibility: "followers",
    });
    expect(result.ok).toBe(false);
    expect(result.errors.visibility).toBeTruthy();
  });
});

describe("validateListItemInput", () => {
  it("accepts a valid uuid + slug and trims", () => {
    const result = validateListItemInput({
      listId: `  ${UUID}  `,
      mediaSlug: "  afterglow  ",
    });
    expect(result.ok).toBe(true);
    expect(result.value).toEqual({ listId: UUID, mediaSlug: "afterglow" });
  });

  it("rejects a non-uuid list id with a safe message", () => {
    const result = validateListItemInput({
      listId: "not-a-uuid",
      mediaSlug: "x",
    });
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/which list/i);
    expect(result.value).toBeUndefined();
  });

  it("rejects an empty media slug", () => {
    const result = validateListItemInput({ listId: UUID, mediaSlug: "   " });
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/which title/i);
  });
});

describe("validateUpdateListInput", () => {
  it("normalizes a valid edit (trimming, clearing, defaults)", () => {
    const result = validateUpdateListInput({
      listId: `  ${UUID}  `,
      title: "  Best Films  ",
      description: "   ",
      isRanked: true,
      visibility: "private",
    });
    expect(result.ok).toBe(true);
    expect(result.value).toEqual({
      listId: UUID,
      title: "Best Films",
      description: null,
      isRanked: true,
      visibility: "private",
    });
  });

  it("defaults visibility to public and description to null when omitted", () => {
    const result = validateUpdateListInput({ listId: UUID, title: "A title" });
    expect(result.ok).toBe(true);
    expect(result.value).toMatchObject({
      visibility: "public",
      description: null,
      isRanked: false,
    });
  });

  it("requires a syntactically valid list id", () => {
    const result = validateUpdateListInput({
      listId: "not-a-uuid",
      title: "ok",
    });
    expect(result.ok).toBe(false);
    expect(result.errors.form).toMatch(/which list/i);
    expect(result.value).toBeUndefined();
  });

  it("requires a non-empty title", () => {
    const result = validateUpdateListInput({ listId: UUID, title: "   " });
    expect(result.ok).toBe(false);
    expect(result.errors.title).toBeTruthy();
  });

  it("rejects an over-long title and description", () => {
    const longTitle = validateUpdateListInput({
      listId: UUID,
      title: "x".repeat(MAX_LIST_TITLE + 1),
    });
    expect(longTitle.ok).toBe(false);
    expect(longTitle.errors.title).toBeTruthy();

    const longDesc = validateUpdateListInput({
      listId: UUID,
      title: "ok",
      description: "y".repeat(MAX_LIST_DESCRIPTION + 1),
    });
    expect(longDesc.ok).toBe(false);
    expect(longDesc.errors.description).toBeTruthy();
  });

  it("rejects an explicit unknown visibility rather than coercing it", () => {
    const result = validateUpdateListInput({
      listId: UUID,
      title: "ok",
      visibility: "followers",
    });
    expect(result.ok).toBe(false);
    expect(result.errors.visibility).toBeTruthy();
  });
});

describe("validateDeleteListInput", () => {
  it("accepts a valid uuid and trims", () => {
    const result = validateDeleteListInput({ listId: `  ${UUID}  ` });
    expect(result.ok).toBe(true);
    expect(result.value).toEqual({ listId: UUID });
  });

  it("rejects a non-uuid list id with a safe message", () => {
    const result = validateDeleteListInput({ listId: "not-a-uuid" });
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/which list/i);
    expect(result.value).toBeUndefined();
  });
});

describe("isUuid", () => {
  it("re-exports the shared uuid guard", () => {
    expect(isUuid(UUID)).toBe(true);
    expect(isUuid("nope")).toBe(false);
  });
});
