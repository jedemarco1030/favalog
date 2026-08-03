import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { MobileNav } from "@/components/layout/mobile-nav";

vi.mock("next/navigation", () => ({
  usePathname: () => "/explore",
}));

describe("MobileNav", () => {
  it("renders the primary destinations and marks the active tab", () => {
    render(<MobileNav />);
    expect(screen.getByRole("link", { name: "Home" })).toHaveAttribute(
      "href",
      "/",
    );
    const explore = screen.getByRole("link", { name: "Explore" });
    expect(explore).toHaveAttribute("href", "/explore");
    expect(explore).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Diary" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Lists" })).toBeInTheDocument();
  });

  it("opens and closes the search sheet", async () => {
    const user = userEvent.setup();
    render(<MobileNav />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Search" }));
    expect(screen.getByRole("dialog", { name: "Search" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Close search" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
