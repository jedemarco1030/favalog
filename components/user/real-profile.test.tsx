import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

import { RealProfile } from "@/components/user/real-profile";
import { getMediaBySlug } from "@/lib/data";
import type { Profile } from "@/lib/types";
import type { RealProfileActivity } from "@/lib/supabase/profile-activity";
import type { ProfileListsResult } from "@/lib/supabase/lists";
import type { ProfileFavoritesResult } from "@/lib/supabase/favorites";
import type { FavoriteView } from "@/lib/supabase/favorite-view-model";
import type { ProfileSocialStateResult } from "@/lib/supabase/follows";

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
const okFavorites: ProfileFavoritesResult = { status: "ok", favorites: [] };

const defaultSocial: ProfileSocialStateResult = {
  status: "ok",
  counts: { followerCount: 0, followingCount: 0 },
  viewerState: { kind: "signed-out" },
};

function favorite(id: string, position: number, slug: string): FavoriteView {
  return { id, position, media: getMediaBySlug(slug)! };
}

function favoritesSection(): HTMLElement {
  const heading = screen.getByRole("heading", {
    name: "Favorites",
    level: 2,
  });
  const section = heading.closest("section");
  if (!section) throw new Error("Favorites section not found");
  return section as HTMLElement;
}

describe("RealProfile", () => {
  describe("social counts and follow controls", () => {
    it("renders real follower and following counts in header", () => {
      render(
        <RealProfile
          profile={profile}
          activity={emptyActivity}
          lists={okLists}
          favorites={okFavorites}
          social={{
            status: "ok",
            counts: { followerCount: 1, followingCount: 42 },
            viewerState: { kind: "signed-out" },
          }}
        />,
      );

      expect(
        screen.getByText((_, el) => el?.textContent === "1 follower"),
      ).toBeInTheDocument();
      expect(
        screen.getByText((_, el) => el?.textContent === "42 following"),
      ).toBeInTheDocument();
    });

    it("renders plural followers label for 0 or multiple followers", () => {
      render(
        <RealProfile
          profile={profile}
          activity={emptyActivity}
          lists={okLists}
          favorites={okFavorites}
          social={{
            status: "ok",
            counts: { followerCount: 0, followingCount: 0 },
            viewerState: { kind: "signed-out" },
          }}
        />,
      );

      expect(
        screen.getByText((_, el) => el?.textContent === "0 followers"),
      ).toBeInTheDocument();
      expect(
        screen.getByText((_, el) => el?.textContent === "0 following"),
      ).toBeInTheDocument();
    });

    it("renders a FollowButton for a signed-in viewer who is not the owner", () => {
      render(
        <RealProfile
          profile={profile}
          activity={emptyActivity}
          lists={okLists}
          favorites={okFavorites}
          social={{
            status: "ok",
            counts: { followerCount: 2, followingCount: 3 },
            viewerState: { kind: "viewer", isFollowing: false },
          }}
          isCurrentUser={false}
        />,
      );

      expect(
        screen.getByRole("button", { name: /follow alice rivera/i }),
      ).toBeInTheDocument();
    });

    it("renders Following state on the FollowButton when viewer is already following", () => {
      render(
        <RealProfile
          profile={profile}
          activity={emptyActivity}
          lists={okLists}
          favorites={okFavorites}
          social={{
            status: "ok",
            counts: { followerCount: 2, followingCount: 3 },
            viewerState: { kind: "viewer", isFollowing: true },
          }}
          isCurrentUser={false}
        />,
      );

      expect(
        screen.getByRole("button", { name: /unfollow alice rivera/i }),
      ).toBeInTheDocument();
    });

    it("renders a sign-in link with returnTo for signed-out visitors", () => {
      render(
        <RealProfile
          profile={profile}
          activity={emptyActivity}
          lists={okLists}
          favorites={okFavorites}
          social={{
            status: "ok",
            counts: { followerCount: 0, followingCount: 0 },
            viewerState: { kind: "signed-out" },
          }}
          isCurrentUser={false}
        />,
      );

      const link = screen.getByRole("link", { name: /^follow$/i });
      expect(link).toHaveAttribute(
        "href",
        "/auth/sign-in?returnTo=%2Fprofile%2Falice",
      );
    });

    it("hides follow control on the owner's own profile", () => {
      render(
        <RealProfile
          profile={profile}
          activity={emptyActivity}
          lists={okLists}
          favorites={okFavorites}
          social={{
            status: "ok",
            counts: { followerCount: 5, followingCount: 10 },
            viewerState: { kind: "owner" },
          }}
          isCurrentUser={true}
        />,
      );

      expect(
        screen.queryByRole("button", { name: /follow/i }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("link", { name: /^follow$/i }),
      ).not.toBeInTheDocument();
    });

    it("removes the deferred 'follows are coming soon' section", () => {
      render(
        <RealProfile
          profile={profile}
          activity={emptyActivity}
          lists={okLists}
          favorites={okFavorites}
          social={defaultSocial}
        />,
      );

      expect(
        screen.queryByText(/follows are coming soon/i),
      ).not.toBeInTheDocument();
    });
  });

  describe("favorites section", () => {
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
          social={defaultSocial}
        />,
      );

      const section = favoritesSection();
      const links = within(section).getAllByRole("link");
      const hrefs = links.map((a) => a.getAttribute("href"));
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
          social={defaultSocial}
          isCurrentUser
        />,
      );
      expect(
        within(favoritesSection()).getByText(
          /you haven't chosen any favorites/i,
        ),
      ).toBeInTheDocument();
    });

    it("shows a visitor-aware empty state when another user has no favorites", () => {
      render(
        <RealProfile
          profile={profile}
          activity={emptyActivity}
          lists={okLists}
          favorites={{ status: "ok", favorites: [] }}
          social={defaultSocial}
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
          social={defaultSocial}
        />,
      );
      expect(
        within(favoritesSection()).getByText(/couldn't be loaded/i),
      ).toBeInTheDocument();
    });
  });
});
