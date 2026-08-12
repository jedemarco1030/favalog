import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DiaryTimeline } from "@/components/diary/diary-timeline";
import type { DiaryEntryView } from "@/components/diary/diary-view";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/diary",
}));

// Owner controls transitively import the server-only edit/delete actions;
// mock them so this UI test never loads a `"use server"` module.
vi.mock("@/app/diary/actions", () => ({
  editDiaryEntryAction: vi.fn(),
  deleteDiaryEntryAction: vi.fn(),
}));

const entries: DiaryEntryView[] = [
  {
    id: "e1",
    loggedAt: "2026-07-10T20:00:00.000Z",
    kind: "movie",
    action: "watched",
    rating: 4.5,
    slug: "afterglow",
    title: "Afterglow",
    year: 2023,
    posterUrl: "/media/posters/afterglow.svg",
  },
  {
    id: "e2",
    loggedAt: "2026-07-02T09:00:00.000Z",
    kind: "book",
    action: "read",
    slug: "the-small-hours",
    title: "The Small Hours",
    year: 2024,
    posterUrl: "/media/posters/smallhours.svg",
    review: { excerpt: "Quiet on purpose." },
  },
  {
    id: "e3",
    loggedAt: "2026-06-20T18:00:00.000Z",
    kind: "movie",
    action: "rewatched",
    slug: "night-ferry",
    title: "Night Ferry",
    year: 2022,
    posterUrl: "/media/posters/nightferry.svg",
  },
];

describe("DiaryTimeline", () => {
  it("renders every entry grouped by month by default", () => {
    render(<DiaryTimeline entries={entries} initialFilter="all" />);
    expect(screen.getByText("Afterglow")).toBeInTheDocument();
    expect(screen.getByText("The Small Hours")).toBeInTheDocument();
    expect(screen.getByText("Night Ferry")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "July 2026" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "June 2026" }),
    ).toBeInTheDocument();
  });

  it("filters entries to the selected media type", async () => {
    const user = userEvent.setup();
    render(<DiaryTimeline entries={entries} initialFilter="all" />);
    const booksButton = screen.getByRole("button", { name: "Books" });
    await user.click(booksButton);
    expect(booksButton).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("The Small Hours")).toBeInTheDocument();
    expect(screen.queryByText("Afterglow")).not.toBeInTheDocument();
  });

  it("shows a type-specific empty state when nothing matches", async () => {
    const user = userEvent.setup();
    render(<DiaryTimeline entries={entries} initialFilter="all" />);
    await user.click(screen.getByRole("button", { name: "TV" }));
    expect(screen.getByText("No TV logged yet.")).toBeInTheDocument();
  });
});
