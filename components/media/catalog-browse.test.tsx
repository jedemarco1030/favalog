import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { CatalogBrowse } from "@/components/media/catalog-browse";
import { getMediaBySlug } from "@/lib/data";
import type { MediaItem } from "@/lib/types";
import type { BrowseOutcome } from "@/lib/supabase/browse-view-model";

const push = vi.fn();
let currentParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/explore",
  useSearchParams: () => currentParams,
}));

const items: MediaItem[] = [
  getMediaBySlug("dune-part-two")!,
  getMediaBySlug("afterglow")!,
].filter(Boolean);

function okOutcome(
  over: Partial<Extract<BrowseOutcome, { status: "ok" }>> = {},
) {
  const base: Extract<BrowseOutcome, { status: "ok" }> = {
    status: "ok",
    items,
    kind: "all",
    sort: "recently_added",
    appliedGenre: null,
    availableGenres: ["Drama", "Sci-Fi"],
    pagination: {
      page: 1,
      pageSize: 24,
      totalCount: 29,
      totalPages: 2,
      hasPrev: false,
      hasNext: true,
    },
  };
  return { ...base, ...over };
}

beforeEach(() => {
  push.mockClear();
  currentParams = new URLSearchParams();
});

describe("CatalogBrowse", () => {
  it("renders the result count, genre + sort controls, and a results grid", () => {
    render(<CatalogBrowse outcome={okOutcome()} />);

    expect(screen.getByText("29 titles")).toBeInTheDocument();

    const genre = screen.getByRole("combobox", { name: /genre/i });
    expect(genre).toHaveValue("");
    expect(
      screen.getByRole("option", { name: "All genres" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Sci-Fi" })).toBeInTheDocument();

    const sort = screen.getByRole("combobox", { name: /sort/i });
    expect(sort).toHaveValue("recently_added");
    expect(
      screen.getByRole("option", { name: "Title A–Z" }),
    ).toBeInTheDocument();

    expect(screen.getAllByRole("listitem")).toHaveLength(items.length);
  });

  it("shows an accessible pagination nav with Previous disabled on the first page", () => {
    render(<CatalogBrowse outcome={okOutcome()} />);

    const nav = screen.getByRole("navigation", { name: "Catalog pages" });
    expect(nav).toBeInTheDocument();
    expect(screen.getByText("Page 1 of 2")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Next" })).toBeEnabled();
  });

  it("navigates preserving other params and resetting page when the sort changes", async () => {
    const user = userEvent.setup();
    currentParams = new URLSearchParams("type=movie&page=2");
    render(<CatalogBrowse outcome={okOutcome({ kind: "movie" })} />);

    await user.selectOptions(
      screen.getByRole("combobox", { name: /sort/i }),
      "title_asc",
    );

    expect(push).toHaveBeenCalledWith("/explore?type=movie&sort=title_asc", {
      scroll: false,
    });
  });

  it("navigates with the chosen genre and resets page", async () => {
    const user = userEvent.setup();
    currentParams = new URLSearchParams("type=movie&page=3");
    render(<CatalogBrowse outcome={okOutcome({ kind: "movie" })} />);

    await user.selectOptions(
      screen.getByRole("combobox", { name: /genre/i }),
      "Sci-Fi",
    );

    expect(push).toHaveBeenCalledWith("/explore?type=movie&genre=Sci-Fi", {
      scroll: false,
    });
  });

  it("pages forward via the Next control", async () => {
    const user = userEvent.setup();
    render(<CatalogBrowse outcome={okOutcome()} />);

    await user.click(screen.getByRole("button", { name: "Next" }));

    expect(push).toHaveBeenCalledWith("/explore?page=2", { scroll: false });
  });

  it("shows a filtered empty state when a page has no results", () => {
    render(
      <CatalogBrowse
        outcome={okOutcome({
          items: [],
          pagination: {
            page: 1,
            pageSize: 24,
            totalCount: 0,
            totalPages: 1,
            hasPrev: false,
            hasNext: false,
          },
        })}
      />,
    );

    expect(
      screen.getByText("No titles match these filters."),
    ).toBeInTheDocument();
    // No pagination nav for a single page.
    expect(
      screen.queryByRole("navigation", { name: "Catalog pages" }),
    ).not.toBeInTheDocument();
  });

  it("renders a controlled error state without any catalog cards", () => {
    render(
      <CatalogBrowse outcome={{ status: "error", category: "database" }} />,
    );

    expect(screen.getByText("Something went wrong.")).toBeInTheDocument();
    expect(screen.queryByRole("listitem")).not.toBeInTheDocument();
  });

  it("renders a controlled unavailable state", () => {
    render(<CatalogBrowse outcome={{ status: "unavailable" }} />);

    expect(
      screen.getByText("Browsing isn’t available right now."),
    ).toBeInTheDocument();
  });
});
