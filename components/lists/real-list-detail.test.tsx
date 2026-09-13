import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RealListDetail } from "@/components/lists/real-list-detail";
import type { ListDetailView } from "@/lib/supabase/list-view-model";

const push = vi.fn();
const refresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh }),
}));

function makeDetail(overrides: Partial<ListDetailView> = {}): ListDetailView {
  return {
    id: "l1",
    slug: "top-sci-fi",
    title: "Top Sci-Fi",
    description: "Favorite sci-fi collection.",
    visibility: "public",
    isRanked: true,
    updatedAt: "2026-08-19T15:31:00.000Z",
    owner: {
      username: "alice",
      displayName: "Alice Smith",
      avatarUrl: null,
    },
    items: [],
    isOwner: false,
    ...overrides,
  };
}

describe("RealListDetail", () => {
  it("renders list details and links creator to their profile", () => {
    render(<RealListDetail list={makeDetail()} />);

    expect(
      screen.getByRole("heading", { name: "Top Sci-Fi" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Favorite sci-fi collection.")).toBeInTheDocument();

    const creatorLink = screen.getByRole("link", {
      name: /a list by alice smith/i,
    });
    expect(creatorLink).toHaveAttribute("href", "/profile/alice");
  });

  it("handles empty or missing creator username gracefully without broken link", () => {
    const list = makeDetail({
      owner: {
        username: "",
        displayName: "Former Member",
        avatarUrl: null,
      },
    });
    render(<RealListDetail list={list} />);

    expect(screen.getByText("Former Member")).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /former member/i }),
    ).not.toBeInTheDocument();
  });

  it("handles null owner gracefully without crashing or broken links", () => {
    const list = makeDetail({ owner: null });
    render(<RealListDetail list={list} />);

    expect(
      screen.getByRole("heading", { name: "Top Sci-Fi" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /a list by/i })).toBeNull();
  });

  it("surfaces owner actions only when isOwner is true", () => {
    const { rerender } = render(
      <RealListDetail list={makeDetail({ isOwner: false })} />,
    );
    expect(
      screen.queryByRole("button", { name: /edit list/i }),
    ).not.toBeInTheDocument();

    rerender(<RealListDetail list={makeDetail({ isOwner: true })} />);
    expect(
      screen.getByRole("button", { name: /edit list/i }),
    ).toBeInTheDocument();
  });
});
