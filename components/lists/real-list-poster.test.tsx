import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RealListPoster } from "@/components/lists/real-list-poster";

describe("RealListPoster", () => {
  it("renders an image when a poster URL is present", () => {
    render(
      <RealListPoster
        posterUrl="https://example.com/afterglow.jpg"
        title="Afterglow"
        kind="movie"
      />,
    );

    const img = screen.getByRole("img", { name: "Afterglow cover" });
    expect(img).toBeInTheDocument();
  });

  it("renders an accessible fallback (no broken image) when the poster URL is empty", () => {
    render(<RealListPoster posterUrl="" title="Afterglow" kind="book" />);

    // The honest kind-aware fallback exposes an accessible name and there is
    // no <img> element with an empty src.
    expect(
      screen.getByRole("img", { name: "Afterglow (no cover art)" }),
    ).toBeInTheDocument();
    expect(document.querySelector("img")).toBeNull();
  });

  it("omits the accessible name when decorative", () => {
    render(
      <RealListPoster posterUrl="" title="Afterglow" kind="tv" decorative />,
    );
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });
});
