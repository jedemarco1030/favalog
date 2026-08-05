import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock the Server Action boundary so this UI test never imports server-only
// modules and can drive `useActionState` deterministically. The action's real
// behavior is covered by the pure helpers it composes (validation, error
// mapping, safe redirects), which are unit-tested separately.
const signInAction = vi.fn();
vi.mock("@/app/auth/actions", () => ({
  signInAction: (...args: unknown[]) => signInAction(...args),
}));

import { SignInForm } from "@/components/auth/sign-in-form";

describe("SignInForm", () => {
  beforeEach(() => {
    signInAction.mockReset();
  });

  it("renders accessible email and password fields", () => {
    signInAction.mockResolvedValue({ status: "idle" });
    render(<SignInForm />);

    expect(screen.getByLabelText("Email")).toHaveAttribute(
      "autocomplete",
      "email",
    );
    expect(screen.getByLabelText("Password")).toHaveAttribute(
      "autocomplete",
      "current-password",
    );
    expect(screen.getByRole("button", { name: "Sign in" })).toBeInTheDocument();
  });

  it("forwards a returnTo as a hidden field", () => {
    signInAction.mockResolvedValue({ status: "idle" });
    const { container } = render(<SignInForm returnTo="/diary" />);
    const hidden = container.querySelector('input[name="returnTo"]');
    expect(hidden).toHaveAttribute("value", "/diary");
  });

  it("shows the server's error message as an alert after submitting", async () => {
    const user = userEvent.setup();
    signInAction.mockResolvedValue({
      status: "error",
      message: "The email or password you entered is incorrect.",
    });
    render(<SignInForm />);

    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The email or password you entered is incorrect.",
    );
  });
});
