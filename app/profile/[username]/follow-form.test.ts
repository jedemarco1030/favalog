import { describe, expect, it } from "vitest";

import { parseFollowFormData } from "./follow-form";

describe("parseFollowFormData", () => {
  it("parses username and isFollow = true", () => {
    const formData = new FormData();
    formData.append("username", "alice_test");
    formData.append("isFollow", "true");

    expect(parseFollowFormData(formData)).toEqual({
      username: "alice_test",
      isFollow: true,
    });
  });

  it("parses isFollow = false when string is 'false'", () => {
    const formData = new FormData();
    formData.append("username", "bob_test");
    formData.append("isFollow", "false");

    expect(parseFollowFormData(formData)).toEqual({
      username: "bob_test",
      isFollow: false,
    });
  });

  it("treats missing or invalid values safely", () => {
    const formData = new FormData();

    expect(parseFollowFormData(formData)).toEqual({
      username: "",
      isFollow: false,
    });
  });
});
