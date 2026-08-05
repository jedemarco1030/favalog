import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { ListsBrowser } from "@/components/lists/lists-browser";
import type { ListCardView } from "@/components/lists/list-view";

function view(overrides: Partial<ListCardView> & { id: string }): ListCardView {
  return {
    slug: overrides.id,
    title: "Untitled",
    itemCount: 3,
    likeCount: 10,
    isRanked: false,
    owner: { displayName: "Owner", username: "owner", avatarUrl: "/a.svg" },
    covers: [],
    kinds: ["movie"],
    ...overrides,
  };
}

const lists: ListCardView[] = [
  view({
    id: "l_scifi",
    slug: "favorite-sci-fi",
    title: "Favorite Sci-Fi",
    owner: {
      displayName: "Jules Marchetti",
      username: "jules",
      avatarUrl: "/j.svg",
    },
  }),
  view({
    id: "l_comfort",
    slug: "comfort-watches",
    title: "Comfort Watches",
    owner: { displayName: "Sana Iyer", username: "sana", avatarUrl: "/s.svg" },
  }),
];

const haystack: Record<string, string> = {
  l_scifi: "favorite sci-fi jules marchetti jules",
  l_comfort: "comfort watches sana iyer sana",
};

function renderBrowser() {
  return render(
    <ListsBrowser
      lists={lists}
      haystack={haystack}
      defaultSections={<div>Curated sections</div>}
    />,
  );
}

describe("ListsBrowser", () => {
  it("shows the curated sections when there is no query", () => {
    renderBrowser();
    expect(screen.getByText("Curated sections")).toBeInTheDocument();
    expect(screen.queryByText(/Results for/)).not.toBeInTheDocument();
  });

  it("filters lists by a case-insensitive query", async () => {
    const user = userEvent.setup();
    renderBrowser();

    await user.type(
      screen.getByRole("searchbox", { name: "Search lists" }),
      "COMFORT",
    );

    expect(screen.getByText(/Results for/)).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Comfort Watches" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Favorite Sci-Fi" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Curated sections")).not.toBeInTheDocument();
  });

  it("matches on the creator's name", async () => {
    const user = userEvent.setup();
    renderBrowser();

    await user.type(
      screen.getByRole("searchbox", { name: "Search lists" }),
      "jules",
    );

    expect(
      screen.getByRole("heading", { name: "Favorite Sci-Fi" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Comfort Watches" }),
    ).not.toBeInTheDocument();
  });

  it("shows an empty state when nothing matches", async () => {
    const user = userEvent.setup();
    renderBrowser();

    await user.type(
      screen.getByRole("searchbox", { name: "Search lists" }),
      "zzzznope",
    );

    expect(screen.getByText("No lists match that search.")).toBeInTheDocument();
  });
});
