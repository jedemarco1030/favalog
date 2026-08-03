import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  MediaTypeBadge,
  mediaKindLabel,
} from "@/components/media/media-type-badge";

describe("MediaTypeBadge", () => {
  it("labels each media kind with the product vocabulary", () => {
    const { rerender } = render(<MediaTypeBadge kind="movie" />);
    expect(screen.getByText("Film")).toBeInTheDocument();

    rerender(<MediaTypeBadge kind="tv" />);
    expect(screen.getByText("Series")).toBeInTheDocument();

    rerender(<MediaTypeBadge kind="book" />);
    expect(screen.getByText("Book")).toBeInTheDocument();
  });
});

describe("mediaKindLabel", () => {
  it("maps kinds to their display labels", () => {
    expect(mediaKindLabel("movie")).toBe("Film");
    expect(mediaKindLabel("tv")).toBe("Series");
    expect(mediaKindLabel("book")).toBe("Book");
  });
});
