import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ExploreDiscovery } from "@/components/media/explore-discovery";
import { getAllMedia, searchTermsFor } from "@/lib/data";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
  usePathname: () => "/explore",
}));

const items = getAllMedia();
const haystack: Record<string, string> = Object.fromEntries(
  items.map((item) => [item.id, searchTermsFor(item).join(" ").toLowerCase()]),
);

function renderExplore(
  props: Partial<React.ComponentProps<typeof ExploreDiscovery>> = {},
) {
  return render(
    <ExploreDiscovery
      items={items}
      haystack={haystack}
      initialQuery=""
      initialFilter="all"
      defaultSections={<div>Editorial shelves</div>}
      {...props}
    />,
  );
}

describe("ExploreDiscovery", () => {
  it("shows the editorial default sections with no query or filter", () => {
    renderExplore();
    expect(screen.getByText("Editorial shelves")).toBeInTheDocument();
    expect(screen.queryByText(/Results for/)).not.toBeInTheDocument();
  });

  it("filters results by a case-insensitive search query", async () => {
    const user = userEvent.setup();
    renderExplore();
    await user.type(
      screen.getByRole("searchbox", { name: "Search Favalog" }),
      "AFTERGLOW",
    );
    expect(screen.getByText(/Results for/)).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Afterglow" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "The Small Hours" }),
    ).not.toBeInTheDocument();
  });

  it("shows an empty state when nothing matches the query", async () => {
    const user = userEvent.setup();
    renderExplore();
    await user.type(
      screen.getByRole("searchbox", { name: "Search Favalog" }),
      "zzzznomatch",
    );
    expect(screen.getByText("No matches yet.")).toBeInTheDocument();
  });

  it("filters by media type when a type button is pressed", async () => {
    const user = userEvent.setup();
    renderExplore();
    const moviesButton = screen.getByRole("button", { name: "Movies" });
    await user.click(moviesButton);
    expect(moviesButton).toHaveAttribute("aria-pressed", "true");
    expect(
      screen.getByRole("heading", { name: "Afterglow" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "The Small Hours" }),
    ).not.toBeInTheDocument();
    // Editorial shelves are replaced by the filtered grid.
    expect(screen.queryByText("Editorial shelves")).not.toBeInTheDocument();
  });
});
