import { describe, expect, it } from "vitest";
import { describeAuthQueryError } from "@/lib/auth/errors";

describe("describeAuthQueryError", () => {
  it("maps known error codes to safe messages", () => {
    expect(describeAuthQueryError("oauth_failed")).toMatch(/Google/);
    expect(describeAuthQueryError("confirmation_expired")).toMatch(/expired/);
    expect(describeAuthQueryError("callback_failed")).toMatch(/sign-in/i);
  });

  it("returns null for unknown or missing codes (never echoes raw params)", () => {
    expect(describeAuthQueryError(null)).toBeNull();
    expect(describeAuthQueryError("")).toBeNull();
    expect(describeAuthQueryError("<script>alert(1)</script>")).toBeNull();
  });
});
