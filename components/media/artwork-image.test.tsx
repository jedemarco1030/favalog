import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ArtworkImage } from "./artwork-image";
import { MediaPoster } from "./media-poster";

describe("provider artwork", () => {
  it("replaces a failed provider image with an intentional accessible fallback", () => {
    render(
      <ArtworkImage
        src="https://image.tmdb.org/t/p/w500/broken.jpg"
        alt="Example cover"
        sizes="100px"
        fallback={<span>No artwork available</span>}
      />,
    );
    fireEvent.error(screen.getByRole("img", { name: "Example cover" }));
    expect(screen.getByText("No artwork available")).toBeVisible();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("allows a different provider URL to load after a prior failure", () => {
    const props = {
      alt: "Example cover",
      sizes: "100px",
      fallback: <span>No artwork available</span>,
    };
    const { rerender } = render(
      <ArtworkImage
        {...props}
        src="https://image.tmdb.org/t/p/w500/first.jpg"
      />,
    );
    fireEvent.error(screen.getByRole("img"));
    rerender(
      <ArtworkImage
        {...props}
        src="https://image.tmdb.org/t/p/w500/second.jpg"
      />,
    );
    expect(screen.getByRole("img", { name: "Example cover" })).toBeVisible();
    expect(screen.queryByText("No artwork available")).not.toBeInTheDocument();
  });

  it.each([
    "",
    "/media/posters/example.svg",
    "https://unapproved.example/cover.jpg",
  ])("never presents %s as an authentic cover", (posterUrl) => {
    render(<MediaPoster item={{ title: "Example", posterUrl }} />);
    expect(
      screen.getByRole("img", { name: "Example (no artwork)" }),
    ).toBeVisible();
    expect(
      screen.queryByRole("img", { name: "Example cover" }),
    ).not.toBeInTheDocument();
  });
});
