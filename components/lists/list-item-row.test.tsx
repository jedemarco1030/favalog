import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ListItemRow } from "@/components/lists/list-item-row";
import { getMediaBySlug } from "@/lib/data";
import type { Book, Movie } from "@/lib/types";

const afterglow = getMediaBySlug("afterglow") as Movie;
const smallHours = getMediaBySlug("the-small-hours") as Book;

describe("ListItemRow", () => {
  it("links the title to its stable slug route", () => {
    render(<ListItemRow item={afterglow} />);
    const link = screen.getByRole("link", {
      name: /Afterglow \(Film, 2023\)/,
    });
    expect(link).toHaveAttribute("href", "/title/afterglow");
  });

  it("shows the rank only when one is provided", () => {
    const { rerender } = render(<ListItemRow item={afterglow} rank={2} />);
    expect(screen.getByText("2")).toBeInTheDocument();

    rerender(<ListItemRow item={afterglow} />);
    expect(screen.queryByText("2")).not.toBeInTheDocument();
  });

  it("renders an optional curator note when present", () => {
    render(<ListItemRow item={afterglow} note="A quiet knockout." />);
    expect(screen.getByText(/A quiet knockout\./)).toBeInTheDocument();
  });

  it("renders a book item with the shared row (no per-kind branch)", () => {
    render(<ListItemRow item={smallHours} rank={1} />);
    expect(
      screen.getByRole("heading", { name: /The Small Hours/ }),
    ).toBeInTheDocument();
    expect(screen.getByText("Book")).toBeInTheDocument();
  });
});
