import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ExploreSearch } from "@/components/media/explore-search";
import type { TrackFn } from "@/lib/analytics/search-analytics";
import { getMediaBySlug } from "@/lib/data";
import type { MediaItem } from "@/lib/types";
import type { SearchOutcome } from "@/lib/supabase/search-view-model";

const nav = vi.hoisted(() => ({
  push: vi.fn(),
  searchParams: new URLSearchParams(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: nav.push, replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/explore",
  useSearchParams: () => nav.searchParams,
}));

beforeEach(() => {
  nav.push.mockClear();
  nav.searchParams = new URLSearchParams();
});

const results: MediaItem[] = [
  getMediaBySlug("dune-part-two")!,
  getMediaBySlug("afterglow")!,
  getMediaBySlug("northlight")!,
].filter(Boolean);

const okOutcome: SearchOutcome = {
  status: "ok",
  query: "memory and grief",
  kind: "movie",
  mode: "hybrid",
  items: results,
  count: results.length,
};

const zeroOutcome: SearchOutcome = {
  status: "ok",
  query: "zxqv nonexistent",
  kind: "all",
  mode: "keyword_fallback",
  items: [],
  count: 0,
};

const defaultSections = <div>editorial</div>;

describe("ExploreSearch analytics", () => {
  it("emits one coarse search-outcome event on a rendered successful outcome", () => {
    const track = vi.fn<TrackFn>();
    render(
      <ExploreSearch
        initialQuery="memory and grief"
        initialFilter="movie"
        outcome={okOutcome}
        defaultSections={defaultSections}
        analyticsTrack={track}
      />,
    );

    expect(track).toHaveBeenCalledTimes(1);
    expect(track).toHaveBeenCalledWith("explore_search", {
      mode: "hybrid",
      filter: "movie",
      zeroResult: false,
      resultCountBucket: "1-3",
    });
    // No query text, title, or slug is ever sent.
    const props = track.mock.calls[0][1] ?? {};
    expect(Object.keys(props)).not.toContain("query");
    expect(Object.keys(props)).not.toContain("title");
    expect(Object.keys(props)).not.toContain("slug");
  });

  it("reports a zero-result outcome as a coarse event", () => {
    const track = vi.fn<TrackFn>();
    render(
      <ExploreSearch
        initialQuery="zxqv nonexistent"
        initialFilter="all"
        outcome={zeroOutcome}
        defaultSections={defaultSections}
        analyticsTrack={track}
      />,
    );

    expect(track).toHaveBeenCalledWith("explore_search", {
      mode: "keyword_fallback",
      filter: "all",
      zeroResult: true,
      resultCountBucket: "0",
    });
  });

  it("does not emit a search-outcome event when no query is active", () => {
    const track = vi.fn<TrackFn>();
    render(
      <ExploreSearch
        initialQuery=""
        initialFilter="all"
        outcome={null}
        defaultSections={defaultSections}
        analyticsTrack={track}
      />,
    );

    expect(track).not.toHaveBeenCalled();
  });

  it("emits a coarse result-selected event with a bucketed rank on click", async () => {
    const user = userEvent.setup();
    const track = vi.fn<TrackFn>();
    render(
      <ExploreSearch
        initialQuery="memory and grief"
        initialFilter="movie"
        outcome={okOutcome}
        defaultSections={defaultSections}
        analyticsTrack={track}
      />,
    );

    // The first result card (rank 1).
    const firstLink = screen.getAllByRole("link")[0];
    await user.click(firstLink);

    const selection = track.mock.calls.find(
      ([name]) => name === "explore_result_selected",
    );
    expect(selection).toBeDefined();
    expect(selection![1]).toEqual({
      mode: "hybrid",
      filter: "movie",
      resultKind: results[0].kind,
      rankBucket: "1",
    });
  });

  it("still navigates (link retains its href) when analytics throws", async () => {
    const user = userEvent.setup();
    const throwing: TrackFn = () => {
      throw new Error("analytics blocked");
    };
    render(
      <ExploreSearch
        initialQuery="memory and grief"
        initialFilter="movie"
        outcome={okOutcome}
        defaultSections={defaultSections}
        analyticsTrack={throwing}
      />,
    );

    const firstLink = screen.getAllByRole("link")[0];
    // The click handler must not throw, and the link keeps its navigation href.
    await expect(user.click(firstLink)).resolves.toBeUndefined();
    expect(firstLink).toHaveAttribute("href", `/title/${results[0].slug}`);
  });
});

describe("ExploreSearch media-type filter navigation", () => {
  it("does NOT activate search mode from unsubmitted input when the media type changes", async () => {
    const user = userEvent.setup();
    // No committed query: this is real browse mode.
    render(
      <ExploreSearch
        initialQuery=""
        initialFilter="all"
        outcome={null}
        defaultSections={defaultSections}
      />,
    );

    // The visitor types into the search box but never submits.
    await user.type(screen.getByRole("searchbox"), "half typed");

    // Then switches the media-type filter to Movies.
    await user.click(screen.getByRole("button", { name: "Movies" }));

    expect(nav.push).toHaveBeenCalledTimes(1);
    const target = nav.push.mock.calls[0][0] as string;
    // The unsubmitted text must NOT leak into the URL as ?q= (which would flip
    // the page into search mode and hide the browse Genre/Sort controls).
    expect(target).not.toContain("q=");
    expect(target).toContain("type=movie");
  });

  it("preserves a committed query when the media type changes (search stays active)", async () => {
    const user = userEvent.setup();
    nav.searchParams = new URLSearchParams("q=dune&type=all");
    render(
      <ExploreSearch
        initialQuery="dune"
        initialFilter="all"
        outcome={okOutcome}
        defaultSections={defaultSections}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Books" }));

    expect(nav.push).toHaveBeenCalledTimes(1);
    const target = nav.push.mock.calls[0][0] as string;
    expect(target).toContain("q=dune");
    expect(target).toContain("type=book");
  });

  it("preserves an existing sort param when the media type changes", async () => {
    const user = userEvent.setup();
    // Real browse with a chosen sort but no query.
    nav.searchParams = new URLSearchParams("sort=highest_rated");
    render(
      <ExploreSearch
        initialQuery=""
        initialFilter="all"
        outcome={null}
        defaultSections={defaultSections}
      />,
    );

    await user.click(screen.getByRole("button", { name: "TV" }));

    const target = nav.push.mock.calls[0][0] as string;
    expect(target).toContain("sort=highest_rated");
    expect(target).toContain("type=tv");
    expect(target).not.toContain("q=");
  });

  it("resets pagination when the media type changes", async () => {
    const user = userEvent.setup();
    nav.searchParams = new URLSearchParams("page=3&sort=newest");
    render(
      <ExploreSearch
        initialQuery=""
        initialFilter="all"
        outcome={null}
        defaultSections={defaultSections}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Movies" }));

    const target = nav.push.mock.calls[0][0] as string;
    expect(target).not.toContain("page=");
    expect(target).toContain("sort=newest");
  });
});
