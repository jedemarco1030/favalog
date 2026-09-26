import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { FeaturedBanner } from "@/components/home/featured-banner";
import { KindShelf } from "@/components/home/kind-shelf";
import { HomeSources } from "@/components/home/home-sources";
import { books, movies } from "@/lib/data";

describe("FeaturedBanner", () => {
  it("names the title and links to its page with a kind-specific action", () => {
    const item = { ...movies[0], backdropUrl: "/media/backdrops/example.svg" };
    render(<FeaturedBanner item={item} eyebrow="Editor's pick" />);
    expect(
      screen.getByRole("heading", { level: 2, name: item.title }),
    ).toBeInTheDocument();
    expect(screen.getByText("Editor's pick")).toBeInTheDocument();
    expect(
      screen.getByRole("link", {
        name: new RegExp(`View film.*${item.title}`),
      }),
    ).toHaveAttribute("href", `/title/${item.slug}`);
  });

  it("uses the poster layout when there is no backdrop", () => {
    const item = { ...books[0], backdropUrl: undefined };
    const { container } = render(
      <FeaturedBanner item={item} eyebrow="From the catalog" />,
    );
    expect(
      screen.getByRole("link", { name: new RegExp(`View book`) }),
    ).toBeInTheDocument();
    // No full-bleed backdrop scrim is rendered without backdrop artwork.
    expect(container.querySelector(".bg-gradient-to-t")).toBeNull();
  });
});

describe("KindShelf", () => {
  it("renders nothing for an empty media type", () => {
    const { container } = render(<KindShelf kind="game" items={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("describes itself as recently added, not popular, and links to the filter", () => {
    render(<KindShelf kind="movie" items={movies.slice(0, 2)} />);
    expect(
      screen.getByRole("heading", { name: "Explore films" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Not a popularity ranking/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Browse all/ })).toHaveAttribute(
      "href",
      "/explore?type=movie",
    );
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
  });
});

describe("HomeSources", () => {
  it("credits only providers that were displayed", () => {
    render(<HomeSources providers={["rawg"]} />);
    expect(screen.getByRole("link", { name: "RAWG" })).toBeInTheDocument();
    expect(screen.queryByText(/TMDB/)).toBeNull();
  });

  it("renders nothing when no external data was shown", () => {
    const { container } = render(<HomeSources providers={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
