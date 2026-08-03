import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EmptyState } from "@/components/ui/empty-state";

describe("EmptyState", () => {
  it("renders the title and optional description", () => {
    render(<EmptyState title="No matches yet." description="Try again." />);
    expect(screen.getByText("No matches yet.")).toBeInTheDocument();
    expect(screen.getByText("Try again.")).toBeInTheDocument();
  });

  it("renders a provided action slot", () => {
    render(
      <EmptyState
        title="Empty"
        action={<a href="/explore">Go to Explore</a>}
      />,
    );
    expect(
      screen.getByRole("link", { name: "Go to Explore" }),
    ).toBeInTheDocument();
  });
});
