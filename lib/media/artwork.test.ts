import { describe, expect, it } from "vitest";
import {
  classifyArtwork,
  displayableArtwork,
  hasProviderBackdrop,
  hasProviderPoster,
} from "./artwork";

describe("classifyArtwork", () => {
  it("accepts HTTPS artwork on the approved provider CDNs", () => {
    expect(classifyArtwork("https://image.tmdb.org/t/p/w500/a.jpg")).toBe(
      "provider",
    );
    expect(classifyArtwork("https://covers.openlibrary.org/b/id/1-L.jpg")).toBe(
      "provider",
    );
    expect(classifyArtwork("https://media.rawg.io/media/games/a.jpg")).toBe(
      "provider",
    );
  });

  it("treats bundled demo graphics as placeholders, not artwork", () => {
    expect(classifyArtwork("/media/posters/dune-part-two.svg")).toBe(
      "placeholder",
    );
  });

  it("treats empty, unknown-host, insecure, and malformed URLs as missing", () => {
    expect(classifyArtwork(undefined)).toBe("missing");
    expect(classifyArtwork(null)).toBe("missing");
    expect(classifyArtwork("")).toBe("missing");
    expect(classifyArtwork("https://example.com/a.jpg")).toBe("missing");
    expect(classifyArtwork("http://image.tmdb.org/t/p/w500/a.jpg")).toBe(
      "missing",
    );
    expect(classifyArtwork("not a url")).toBe("missing");
  });
});

describe("displayable artwork helpers", () => {
  it("only returns provider URLs", () => {
    const real = "https://image.tmdb.org/t/p/w500/a.jpg";
    expect(displayableArtwork(real)).toBe(real);
    expect(displayableArtwork("/media/posters/x.svg")).toBeUndefined();
  });

  it("checks poster and backdrop independently", () => {
    const item = {
      posterUrl: "/media/posters/x.svg",
      backdropUrl: "https://image.tmdb.org/t/p/w1280/b.jpg",
    };
    expect(hasProviderPoster(item)).toBe(false);
    expect(hasProviderBackdrop(item)).toBe(true);
  });
});
