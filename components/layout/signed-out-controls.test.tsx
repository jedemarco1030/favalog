import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SignedOutControls } from "@/components/layout/signed-out-controls";

describe("SignedOutControls", () => {
  it("links to sign-in and sign-up", () => {
    render(<SignedOutControls />);

    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute(
      "href",
      "/auth/sign-in",
    );
    // The CTA label is responsive ("Start your Favalog" / "Sign up"); match by href.
    const cta = screen.getByRole("link", {
      name: /Start your Favalog|Sign up/,
    });
    expect(cta).toHaveAttribute("href", "/auth/sign-up");
  });
});
