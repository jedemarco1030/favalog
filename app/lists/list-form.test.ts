import { describe, expect, it } from "vitest";

import { parseCreateListFormData, parseListItemFormData } from "./list-form";

function fd(entries: Record<string, string>): FormData {
  const form = new FormData();
  for (const [key, value] of Object.entries(entries)) form.append(key, value);
  return form;
}

describe("parseCreateListFormData", () => {
  it("reads only the allow-listed fields", () => {
    const form = fd({
      title: "My Films",
      description: "A canon.",
      isRanked: "on",
      visibility: "private",
      mediaSlug: "afterglow",
      // Hostile extras that must be ignored (never trusted).
      userId: "hacker",
      ownerId: "hacker",
      position: "99",
    });
    expect(parseCreateListFormData(form)).toEqual({
      title: "My Films",
      description: "A canon.",
      isRanked: true,
      visibility: "private",
      mediaSlug: "afterglow",
    });
  });

  it("defaults missing optional fields", () => {
    const parsed = parseCreateListFormData(fd({ title: "Just a title" }));
    expect(parsed).toEqual({
      title: "Just a title",
      description: null,
      isRanked: false,
      visibility: null,
      mediaSlug: null,
    });
  });
});

describe("parseListItemFormData", () => {
  it("reads only the list id and trusted media slug", () => {
    const form = fd({
      listId: "11111111-1111-1111-1111-111111111111",
      mediaSlug: "afterglow",
      userId: "hacker",
      position: "0",
      mediaId: "not-trusted",
    });
    expect(parseListItemFormData(form)).toEqual({
      listId: "11111111-1111-1111-1111-111111111111",
      mediaSlug: "afterglow",
    });
  });

  it("defaults missing fields to empty strings", () => {
    expect(parseListItemFormData(fd({}))).toEqual({
      listId: "",
      mediaSlug: "",
    });
  });
});
