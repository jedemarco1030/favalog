import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MediaCard } from "@/components/media/media-card";
import { getMediaBySlug } from "@/lib/data";
import type { Movie } from "@/lib/types";

const afterglow = getMediaBySlug("afterglow") as Movie;

describe("MediaCard", () => {
  it("links to the title's stable slug route", () => {
    render(<MediaCard item={afterglow} />);
    const link = screen.getByRole("link", {
      name: /Afterglow \(Film, 2023\)/,
    });
    expect(link).toHaveAttribute("href", "/title/afterglow");
  });

  it("renders the title as a heading and the rating", () => {
    render(<MediaCard item={afterglow} />);
    expect(
      screen.getByRole("heading", { name: "Afterglow" }),
    ).toBeInTheDocument();
    expect(screen.getByText("4.3")).toBeInTheDocument();
  });

  it("shows the synopsis in the wide variant", () => {
    render(<MediaCard item={afterglow} variant="wide" />);
    expect(
      screen.getByText(/composer returns to the coastal town/i),
    ).toBeInTheDocument();
    expect(screen.getByText("Film")).toBeInTheDocument();
  });
});
