import { describe, expect, it } from "vitest";

import { GENERIC_AUTH_ERROR, mapAuthError } from "@/lib/auth/errors";

describe("mapAuthError", () => {
  it("returns GENERIC_AUTH_ERROR for nullish input", () => {
    expect(mapAuthError(null)).toBe(GENERIC_AUTH_ERROR);
    expect(mapAuthError(undefined)).toBe(GENERIC_AUTH_ERROR);
  });

  it("maps rate limit errors to a stable message", () => {
    expect(
      mapAuthError({
        status: 429,
        code: "over_email_send_rate_limit",
        message: "Rate limit exceeded",
      }),
    ).toBe("Too many attempts. Please wait a little while and try again.");
  });

  it("maps invalid credentials", () => {
    expect(
      mapAuthError({
        status: 400,
        code: "invalid_credentials",
        message: "Invalid login",
      }),
    ).toBe("The email or password you entered is incorrect.");
  });

  it("maps email not confirmed", () => {
    expect(
      mapAuthError({
        status: 400,
        code: "email_not_confirmed",
        message: "Not confirmed",
      }),
    ).toBe("Please confirm your email address, then sign in.");
  });

  it("maps weak password", () => {
    expect(
      mapAuthError({
        status: 400,
        code: "weak_password",
        message: "Weak password",
      }),
    ).toBe("Please choose a stronger password.");
  });

  it("maps same password", () => {
    expect(
      mapAuthError({
        status: 400,
        code: "same_password",
        message: "Should be different",
      }),
    ).toBe("Your new password must be different from the current one.");
  });

  it("maps expired or missing session links", () => {
    expect(
      mapAuthError({
        status: 400,
        code: "session_not_found",
        message: "Session not found",
      }),
    ).toBe("This link is invalid or has expired. Please request a new one.");

    expect(
      mapAuthError({
        status: 400,
        code: "flow_state_expired",
        message: "Flow state expired",
      }),
    ).toBe("This link is invalid or has expired. Please request a new one.");
  });

  it("collapses unknown errors to GENERIC_AUTH_ERROR", () => {
    expect(
      mapAuthError({
        status: 500,
        code: "some_unknown_error",
        message: "Unexpected",
      }),
    ).toBe(GENERIC_AUTH_ERROR);
  });

  it("keeps sign-up and reset flows enumeration-safe", () => {
    const alreadyRegistered = {
      status: 400,
      code: "already_registered",
      message: "already registered",
    };

    expect(mapAuthError(alreadyRegistered, "sign-up")).toBe(GENERIC_AUTH_ERROR);
    expect(mapAuthError(alreadyRegistered, "reset")).toBe(GENERIC_AUTH_ERROR);
  });
});
