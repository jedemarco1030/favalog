import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import {
  ProviderAttribution,
  TMDB_ATTRIBUTION_NOTICE,
} from "@/components/media/provider-attribution";

describe("ProviderAttribution", () => {
  it("renders the mandatory TMDB notice verbatim plus the TMDB logo", () => {
    render(<ProviderAttribution provider="tmdb" />);
    expect(screen.getByText(TMDB_ATTRIBUTION_NOTICE)).toBeInTheDocument();
    // The notice text must match TMDB's required wording exactly.
    expect(TMDB_ATTRIBUTION_NOTICE).toBe(
      "This product uses the TMDB API but is not endorsed or certified by TMDB.",
    );
    expect(screen.getByAltText("TMDB")).toBeInTheDocument();
  });

  it("credits and links to Open Library for books", () => {
    render(<ProviderAttribution provider="openlibrary" />);
    const link = screen.getByRole("link", { name: /open library/i });
    expect(link).toHaveAttribute("href", "https://openlibrary.org");
    expect(link).toHaveAttribute("rel", expect.stringContaining("noopener"));
  });

  it("does not imply provider endorsement of Favalog", () => {
    render(<ProviderAttribution provider="tmdb" />);
    expect(screen.queryByText(/endorsed by favalog/i)).not.toBeInTheDocument();
    expect(
      screen.getByText(/not endorsed or certified by tmdb/i),
    ).toBeInTheDocument();
  });
});
