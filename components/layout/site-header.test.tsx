import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SiteHeader } from "@/components/layout/site-header";
import { getCurrentUser } from "@/lib/data";

describe("SiteHeader", () => {
  it("links the profile avatar to the current viewer's profile", () => {
    render(<SiteHeader />);
    const viewer = getCurrentUser()!;
    expect(screen.getByRole("link", { name: "Your profile" })).toHaveAttribute(
      "href",
      `/profile/${viewer.username}`,
    );
  });
});
