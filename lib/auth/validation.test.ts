import { describe, expect, it } from "vitest";

import {
  BIO_MAX_LENGTH,
  DISPLAY_NAME_MAX_LENGTH,
  LOCATION_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  USERNAME_MAX_LENGTH,
  USERNAME_MIN_LENGTH,
  hasValidUsernameShape,
  isLikelyEmail,
  normalizeEmail,
  normalizeUsername,
  validateBio,
  validateDisplayName,
  validateEmail,
  validateLocation,
  validatePassword,
  validatePasswordConfirmation,
  validateUsername,
} from "@/lib/auth/validation";

describe("auth validation helpers", () => {
  it("exports the expected length constants", () => {
    expect(USERNAME_MIN_LENGTH).toBe(3);
    expect(USERNAME_MAX_LENGTH).toBe(30);
    expect(DISPLAY_NAME_MAX_LENGTH).toBe(80);
    expect(BIO_MAX_LENGTH).toBe(500);
    expect(LOCATION_MAX_LENGTH).toBe(120);
    expect(PASSWORD_MIN_LENGTH).toBe(8);
  });

  it("normalizes email and username by trimming and lowercasing", () => {
    expect(normalizeEmail("  Jamie@EXAMPLE.com ")).toBe("jamie@example.com");
    expect(normalizeUsername("  JohnDoe  ")).toBe("johndoe");
  });

  it("checks likely email shape", () => {
    expect(isLikelyEmail("jamie@example.com")).toBe(true);
    expect(isLikelyEmail("  ")).toBe(false);
    expect(isLikelyEmail("no-at.example")).toBe(false);
    expect(isLikelyEmail("a@b")).toBe(false);
  });

  it("validates email with exact error strings", () => {
    expect(validateEmail(" ")).toBe("Enter your email address.");
    expect(validateEmail("no-at.example")).toBe("Enter a valid email address.");
    expect(validateEmail("jamie@example.com")).toBeNull();
  });

  it("validates username with exact branches", () => {
    expect(validateUsername(" ")).toBe("Choose a username.");
    expect(validateUsername("Jo")).toBe(
      `Usernames must be at least ${USERNAME_MIN_LENGTH} characters.`,
    );
    expect(validateUsername("a".repeat(USERNAME_MAX_LENGTH + 1))).toBe(
      `Usernames must be ${USERNAME_MAX_LENGTH} characters or fewer.`,
    );
    expect(validateUsername("ab-c")).toBe(
      "Usernames can use letters, numbers, and underscores only.",
    );
    expect(validateUsername("John")).toBe(
      "Usernames are lowercase — we'll store it in lowercase.",
    );

    expect(validateUsername("abc")).toBeNull();
    expect(validateUsername("abc_123")).toBeNull();
  });

  it("validates display name with exact error strings", () => {
    expect(validateDisplayName(" ")).toBe("Enter a display name.");
    expect(validateDisplayName("a".repeat(DISPLAY_NAME_MAX_LENGTH + 1))).toBe(
      `Display names must be ${DISPLAY_NAME_MAX_LENGTH} characters or fewer.`,
    );
    expect(validateDisplayName("Jamie")).toBeNull();
  });

  it("validates password with exact error strings", () => {
    expect(validatePassword("")).toBe("Enter a password.");
    expect(validatePassword("1234567")).toBe(
      `Passwords must be at least ${PASSWORD_MIN_LENGTH} characters.`,
    );
    expect(validatePassword("12345678")).toBeNull();
  });

  it("validates password confirmation with exact error strings", () => {
    expect(validatePasswordConfirmation("secret", "")).toBe(
      "Re-enter your password to confirm it.",
    );
    expect(validatePasswordConfirmation("secret1", "secret2")).toBe(
      "Those passwords don't match.",
    );
    expect(validatePasswordConfirmation("secret", "secret")).toBeNull();
  });

  it("validates bio and location with exact error strings", () => {
    expect(validateBio("a".repeat(BIO_MAX_LENGTH + 1))).toBe(
      `Bios must be ${BIO_MAX_LENGTH} characters or fewer.`,
    );
    expect(validateBio("a".repeat(BIO_MAX_LENGTH))).toBeNull();

    expect(validateLocation("a".repeat(LOCATION_MAX_LENGTH + 1))).toBe(
      `Location must be ${LOCATION_MAX_LENGTH} characters or fewer.`,
    );
    expect(validateLocation("a".repeat(LOCATION_MAX_LENGTH))).toBeNull();
  });

  it("checks username DB-shape validity", () => {
    expect(hasValidUsernameShape("abc")).toBe(true);
    expect(hasValidUsernameShape("ABC_123")).toBe(true);
    expect(hasValidUsernameShape("ab")).toBe(false);
    expect(hasValidUsernameShape("ab-c")).toBe(false);
  });
});
