import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AuthMessage } from "@/components/auth/auth-message";

describe("AuthMessage", () => {
  it("renders errors as an assertive alert", () => {
    render(<AuthMessage variant="error">Invalid credentials</AuthMessage>);
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Invalid credentials");
    expect(alert).toHaveAttribute("aria-live", "assertive");
  });

  it("renders non-error outcomes as a polite status region", () => {
    render(<AuthMessage variant="success">Check your email</AuthMessage>);
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("Check your email");
    expect(status).toHaveAttribute("aria-live", "polite");
  });
});
