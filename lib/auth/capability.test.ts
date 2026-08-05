import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  getAuthCapability,
  isAuthAvailable,
  isGoogleOAuthEnabled,
} from "@/lib/auth/capability";

const URL_KEY = "NEXT_PUBLIC_SUPABASE_URL";
const KEY_KEY = "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY";
const GOOGLE_ENABLED_KEY = "NEXT_PUBLIC_SUPABASE_GOOGLE_ENABLED";

describe("auth capability detection", () => {
  let originalUrl: string | undefined;
  let originalKey: string | undefined;
  let originalGoogle: string | undefined;

  beforeEach(() => {
    originalUrl = process.env[URL_KEY];
    originalKey = process.env[KEY_KEY];
    originalGoogle = process.env[GOOGLE_ENABLED_KEY];

    delete process.env[URL_KEY];
    delete process.env[KEY_KEY];
    delete process.env[GOOGLE_ENABLED_KEY];
  });

  afterEach(() => {
    if (originalUrl === undefined) delete process.env[URL_KEY];
    else process.env[URL_KEY] = originalUrl;

    if (originalKey === undefined) delete process.env[KEY_KEY];
    else process.env[KEY_KEY] = originalKey;

    if (originalGoogle === undefined) delete process.env[GOOGLE_ENABLED_KEY];
    else process.env[GOOGLE_ENABLED_KEY] = originalGoogle;
  });

  it("reports available:false and google:false when no env is set", () => {
    expect(isAuthAvailable()).toBe(false);
    expect(isGoogleOAuthEnabled()).toBe(false);
    expect(getAuthCapability()).toEqual({ available: false, google: false });
  });

  it("reports available:true and google:false when url+key are set", () => {
    process.env[URL_KEY] = "https://example.supabase.co";
    process.env[KEY_KEY] = "sb_publishable_abc123";

    expect(isAuthAvailable()).toBe(true);
    expect(isGoogleOAuthEnabled()).toBe(false);
    expect(getAuthCapability()).toEqual({ available: true, google: false });
  });

  it("reports google:true when google flag is true", () => {
    process.env[URL_KEY] = "https://example.supabase.co";
    process.env[KEY_KEY] = "sb_publishable_abc123";
    process.env[GOOGLE_ENABLED_KEY] = "true";

    expect(isAuthAvailable()).toBe(true);
    expect(isGoogleOAuthEnabled()).toBe(true);
    expect(getAuthCapability()).toEqual({ available: true, google: true });
  });

  it("keeps google disabled when google flag is true but Supabase config is missing", () => {
    process.env[GOOGLE_ENABLED_KEY] = "true";

    expect(isAuthAvailable()).toBe(false);
    expect(isGoogleOAuthEnabled()).toBe(false);
    expect(getAuthCapability()).toEqual({ available: false, google: false });
  });
});
