import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RealListCard } from "@/components/lists/real-list-card";
import type {
  ListOwnerView,
  ListSummaryView,
} from "@/lib/supabase/list-view-model";

function makeList(overrides: Partial<ListSummaryView> = {}): ListSummaryView {
  return {
    id: "l1",
    slug: "favorite-sci-fi",
    title: "Favorite Sci-Fi",
    description: null,
    visibility: "public",
    isRanked: false,
    itemCount: 3,
    updatedAt: "2026-08-19T15:31:00.000Z",
    ...overrides,
  };
}

const owner: ListOwnerView = {
  username: "jamie",
  displayName: "Jamie Rivera",
  avatarUrl: null,
};

describe("RealListCard", () => {
  it("renders the title and item count and links to the list slug", () => {
    render(<RealListCard list={makeList()} />);

    expect(
      screen.getByRole("heading", { name: "Favorite Sci-Fi" }),
    ).toBeInTheDocument();
    expect(screen.getByText("3 items")).toBeInTheDocument();
    expect(screen.getByRole("link")).toHaveAttribute(
      "href",
      "/list/favorite-sci-fi",
    );
  });

  it("shows the ranked hint only when the list is ranked", () => {
    const { rerender } = render(<RealListCard list={makeList()} />);
    expect(screen.queryByText("Ranked")).not.toBeInTheDocument();

    rerender(<RealListCard list={makeList({ isRanked: true })} />);
    expect(screen.getByText("Ranked")).toBeInTheDocument();
  });

  it("surfaces the private status only when showVisibility is set (owner view)", () => {
    const privateList = makeList({ visibility: "private" });
    const { rerender } = render(<RealListCard list={privateList} />);
    // Without showVisibility, no status chip leaks the private state.
    expect(screen.queryByText("Private")).not.toBeInTheDocument();

    rerender(<RealListCard list={privateList} showVisibility />);
    expect(screen.getByText("Private")).toBeInTheDocument();
  });

  it("shows the public status when showVisibility is set on a public list", () => {
    render(<RealListCard list={makeList()} showVisibility />);
    expect(screen.getByText("Public")).toBeInTheDocument();
  });

  it("renders the owner's name when an owner is passed", () => {
    render(<RealListCard list={makeList()} owner={owner} />);
    expect(screen.getByText("Jamie Rivera")).toBeInTheDocument();
  });

  it("never renders a like count", () => {
    render(<RealListCard list={makeList()} showVisibility owner={owner} />);
    expect(screen.queryByText(/like/i)).not.toBeInTheDocument();
  });
});
