import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// `HeaderAuth` is an async Server Component that reads the session; stub it so
// this unit test exercises only the synchronous shell composition. The
// signed-out / signed-in controls are covered by their own component tests.
vi.mock("@/components/layout/header-auth", () => ({
  HeaderAuth: () => <div data-testid="header-auth-slot" />,
}));

import { SiteHeader } from "@/components/layout/site-header";

describe("SiteHeader", () => {
  it("renders the shell: home link, notifications, and the auth cluster slot", () => {
    render(<SiteHeader />);

    expect(
      screen.getByRole("link", { name: "Favalog — home" }),
    ).toHaveAttribute("href", "/");
    expect(
      screen.getByRole("button", { name: "Notifications" }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("header-auth-slot")).toBeInTheDocument();
  });
});
