import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Link from "next/link";
import { describe, expect, it } from "vitest";
import { AccountMenu } from "@/components/layout/account-menu";

function renderMenu() {
  return render(
    <AccountMenu displayName="Jamie DeMarco" avatarUrl={null}>
      <Link href="/profile/jamie" role="menuitem">
        View profile
      </Link>
      <button type="button" role="menuitem">
        Sign out
      </button>
    </AccountMenu>,
  );
}

describe("AccountMenu", () => {
  it("labels the trigger and starts collapsed", () => {
    renderMenu();
    const trigger = screen.getByRole("button", {
      name: "Account menu for Jamie DeMarco",
    });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("opens the menu on click and reveals the items", async () => {
    const user = userEvent.setup();
    renderMenu();

    await user.click(
      screen.getByRole("button", { name: "Account menu for Jamie DeMarco" }),
    );

    expect(screen.getByRole("menu", { name: "Account" })).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: "View profile" }),
    ).toHaveAttribute("href", "/profile/jamie");
    expect(
      screen.getByRole("menuitem", { name: "Sign out" }),
    ).toBeInTheDocument();
  });

  it("closes the menu on Escape", async () => {
    const user = userEvent.setup();
    renderMenu();

    await user.click(
      screen.getByRole("button", { name: "Account menu for Jamie DeMarco" }),
    );
    expect(screen.getByRole("menu")).toBeInTheDocument();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });
});
