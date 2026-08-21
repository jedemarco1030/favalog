import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { RealProfile } from "@/components/user/real-profile";
import { getMediaBySlug } from "@/lib/data";
import type { Profile } from "@/lib/types";
import type { RealProfileActivity } from "@/lib/supabase/profile-activity";
import type { ProfileListsResult } from "@/lib/supabase/lists";
import type { ProfileFavoritesResult } from "@/lib/supabase/favorites";
import type { FavoriteView } from "@/lib/supabase/favorite-view-model";

const profile: Profile = {
  id: "u1",
  username: "alice",
  displayName: "Alice Rivera",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const emptyActivity: RealProfileActivity = {
  stats: {
    moviesWatched: 0,
    tvWatched: 0,
    booksRead: 0,
    reviews: 0,
    averageRating: null,
  },
  recentlyWatched: [],
  recentlyRead: [],
  reviews: [],
};

const okLists: ProfileListsResult = { status: "ok", lists: [] };

function favorite(id: string, position: number, slug: string): FavoriteView {
  return { id, position, media: getMediaBySlug(slug)! };
}

/**
 * Locate the Favorites section by its `h2`. `ProfileSection` intentionally
 * leaves the `<section>` unnamed (the visible heading gives structure), so we
 * scope by the heading's nearest section rather than a landmark role.
 */
function favoritesSection(): HTMLElement {
  const heading = screen.getByRole("heading", {
    name: "Favorites",
    level: 2,
  });
  const section = heading.closest("section");
  if (!section) throw new Error("Favorites section not found");
  return section as HTMLElement;
}

describe("RealProfile favorites section", () => {
  it("renders the owner's real favorites in position order as cross-media cards", () => {
    const favorites: ProfileFavoritesResult = {
      status: "ok",
      favorites: [
        favorite("f0", 0, "afterglow"),
        favorite("f1", 1, "northlight"),
        favorite("f2", 2, "the-small-hours"),
      ],
    };

    render(
      <RealProfile
        profile={profile}
        activity={emptyActivity}
        lists={okLists}
        favorites={favorites}
      />,
    );

    const section = favoritesSection();
    const links = within(section).getAllByRole("link");
    const hrefs = links.map((a) => a.getAttribute("href"));
    // Rendered in the stored position order.
    expect(hrefs).toEqual([
      "/title/afterglow",
      "/title/northlight",
      "/title/the-small-hours",
    ]);
  });

  it("shows an owner-aware empty state when the owner has no favorites", () => {
    render(
      <RealProfile
        profile={profile}
        activity={emptyActivity}
        lists={okLists}
        favorites={{ status: "ok", favorites: [] }}
        isCurrentUser
      />,
    );
    expect(
      within(favoritesSection()).getByText(/you haven't chosen any favorites/i),
    ).toBeInTheDocument();
  });

  it("shows a visitor-aware empty state when another user has no favorites", () => {
    render(
      <RealProfile
        profile={profile}
        activity={emptyActivity}
        lists={okLists}
        favorites={{ status: "ok", favorites: [] }}
      />,
    );
    expect(
      within(favoritesSection()).getByText(
        /alice hasn't chosen any favorites/i,
      ),
    ).toBeInTheDocument();
  });

  it("shows a controlled read-error state when favorites can't be loaded", () => {
    render(
      <RealProfile
        profile={profile}
        activity={emptyActivity}
        lists={okLists}
        favorites={{ status: "error" }}
      />,
    );
    expect(
      within(favoritesSection()).getByText(/couldn't be loaded/i),
    ).toBeInTheDocument();
  });

  it("keeps follows honestly deferred and no longer bundles favorites into a 'coming soon' note", () => {
    render(
      <RealProfile
        profile={profile}
        activity={emptyActivity}
        lists={okLists}
        favorites={{ status: "ok", favorites: [] }}
      />,
    );
    expect(screen.getByText(/follows are coming soon/i)).toBeInTheDocument();
    expect(
      screen.queryByText(/favorites and follows are coming soon/i),
    ).not.toBeInTheDocument();
  });
});
