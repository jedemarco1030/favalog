import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { getPublicSupabaseEnv, isSupabaseConfigured } from "./env";

const URL_KEY = "NEXT_PUBLIC_SUPABASE_URL";
const KEY_KEY = "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY";

describe("supabase env", () => {
  const original = {
    url: process.env[URL_KEY],
    key: process.env[KEY_KEY],
  };

  beforeEach(() => {
    delete process.env[URL_KEY];
    delete process.env[KEY_KEY];
  });

  afterEach(() => {
    // Restore the ambient environment so tests never leak configuration.
    if (original.url === undefined) delete process.env[URL_KEY];
    else process.env[URL_KEY] = original.url;
    if (original.key === undefined) delete process.env[KEY_KEY];
    else process.env[KEY_KEY] = original.key;
  });

  it("reports not configured when variables are absent", () => {
    expect(isSupabaseConfigured()).toBe(false);
  });

  it("reports not configured when a variable is blank", () => {
    process.env[URL_KEY] = "https://example.supabase.co";
    process.env[KEY_KEY] = "   ";
    expect(isSupabaseConfigured()).toBe(false);
  });

  it("reports configured when both variables are present", () => {
    process.env[URL_KEY] = "https://example.supabase.co";
    process.env[KEY_KEY] = "sb_publishable_abc123";
    expect(isSupabaseConfigured()).toBe(true);
  });

  it("returns the values when configured", () => {
    process.env[URL_KEY] = "https://example.supabase.co";
    process.env[KEY_KEY] = "sb_publishable_abc123";
    expect(getPublicSupabaseEnv()).toEqual({
      url: "https://example.supabase.co",
      publishableKey: "sb_publishable_abc123",
    });
  });

  it("throws listing every missing variable", () => {
    expect(() => getPublicSupabaseEnv()).toThrow(URL_KEY);
    expect(() => getPublicSupabaseEnv()).toThrow(KEY_KEY);
  });

  it("throws naming only the single missing variable", () => {
    process.env[URL_KEY] = "https://example.supabase.co";
    expect(() => getPublicSupabaseEnv()).toThrow(KEY_KEY);
  });
});
