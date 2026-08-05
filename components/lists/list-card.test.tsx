import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ListCard } from "@/components/lists/list-card";
import type { ListCardView } from "@/components/lists/list-view";

const baseView: ListCardView = {
  id: "l_scifi",
  slug: "favorite-sci-fi",
  title: "Favorite Sci-Fi",
  description: "The genre at its best across every format.",
  itemCount: 7,
  likeCount: 1342,
  isRanked: true,
  owner: {
    displayName: "Jules Marchetti",
    username: "jules",
    avatarUrl: "/media/avatars/jules.svg",
  },
  covers: [
    { id: "m_duneparttwo", title: "Dune: Part Two", posterUrl: "/a.svg" },
    { id: "t_northlight", title: "Northlight", posterUrl: "/b.svg" },
    { id: "b_bright_index", title: "The Bright Index", posterUrl: "/c.svg" },
  ],
  kinds: ["movie", "tv", "book"],
};

function makeView(overrides: Partial<ListCardView> = {}): ListCardView {
  return { ...baseView, ...overrides };
}

describe("ListCard", () => {
  it("links to the list's stable slug route with a meaningful name", () => {
    render(<ListCard list={makeView()} />);
    const link = screen.getByRole("link", {
      name: /Favorite Sci-Fi — a list by Jules Marchetti, 7 items/,
    });
    expect(link).toHaveAttribute("href", "/list/favorite-sci-fi");
  });

  it("shows the title, creator, item count, and like count", () => {
    render(<ListCard list={makeView()} />);
    expect(
      screen.getByRole("heading", { name: "Favorite Sci-Fi" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Jules Marchetti")).toBeInTheDocument();
    expect(screen.getByText("7 items")).toBeInTheDocument();
    expect(screen.getByText("1,342 likes")).toBeInTheDocument();
  });

  it("labels a cross-media list as mixed media and marks it ranked", () => {
    render(<ListCard list={makeView()} />);
    expect(screen.getByText("Mixed media")).toBeInTheDocument();
    expect(screen.getByText("Ranked")).toBeInTheDocument();
  });

  it("labels a single-kind, unranked list by its kind without a ranked badge", () => {
    render(<ListCard list={makeView({ kinds: ["movie"], isRanked: false })} />);
    expect(screen.getByText("Films")).toBeInTheDocument();
    expect(screen.queryByText("Ranked")).not.toBeInTheDocument();
  });

  it("pluralizes a single-item list correctly", () => {
    render(<ListCard list={makeView({ itemCount: 1, likeCount: 1 })} />);
    expect(screen.getByText("1 item")).toBeInTheDocument();
    expect(screen.getByText("1 like")).toBeInTheDocument();
  });
});
