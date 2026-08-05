import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AuthField } from "@/components/auth/auth-field";

describe("AuthField", () => {
  it("associates a visible label and forwards autocomplete/type", () => {
    render(
      <AuthField
        id="email"
        name="email"
        label="Email"
        type="email"
        autoComplete="email"
      />,
    );
    const input = screen.getByLabelText("Email");
    expect(input).toHaveAttribute("type", "email");
    expect(input).toHaveAttribute("autocomplete", "email");
    expect(input).not.toHaveAttribute("aria-invalid");
  });

  it("marks the field invalid and describes it by the error when present", () => {
    render(
      <AuthField
        id="username"
        name="username"
        label="Username"
        error="That username is taken."
      />,
    );
    const input = screen.getByLabelText("Username");
    expect(input).toHaveAttribute("aria-invalid", "true");
    const describedBy = input.getAttribute("aria-describedby");
    expect(describedBy).toContain("username-error");
    expect(screen.getByText("That username is taken.")).toBeInTheDocument();
  });

  it("renders a textarea when multiline", () => {
    render(<AuthField id="bio" name="bio" label="Bio" multiline />);
    expect(screen.getByLabelText("Bio").tagName).toBe("TEXTAREA");
  });
});
