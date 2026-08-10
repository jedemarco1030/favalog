import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MessageSquare } from "lucide-react";
import { Container } from "@/components/ui/container";
import { EmptyState } from "@/components/ui/empty-state";
import {
  ProfileStats,
  type ProfileStat,
} from "@/components/user/profile-stats";
import { ProfileHeader } from "@/components/user/profile-header";
import { ProfileSection } from "@/components/user/profile-section";
import { FavoriteMediaGrid } from "@/components/user/favorite-media-grid";
import { HorizontalMediaRow } from "@/components/media/horizontal-media-row";
import { ReviewCard } from "@/components/reviews/review-card";
import { ActivityCard } from "@/components/activity/activity-card";
import { ListCard } from "@/components/lists/list-card";
import { toListCardView } from "@/components/lists/to-list-card-view";
import { RealProfileIdentity } from "@/components/user/real-profile-identity";
import { RealProfile } from "@/components/user/real-profile";
import {
  currentUserId,
  getListsByUser,
  getMediaById,
  getReviewsByUser,
  getUserByUsername,
  getUserCurrentlyEnjoying,
  getUserFavorites,
  getUserProfileStats,
  getUserRecentActivity,
  getUserRecentlyRead,
  getUserRecentlyWatched,
} from "@/lib/data";
import { isAuthAvailable } from "@/lib/auth/capability";
import { getCurrentUser } from "@/lib/auth/data";
import { getPublicProfileByUsername } from "@/lib/supabase/profiles";
import { getRealProfileActivity } from "@/lib/supabase/profile-activity";
import { siteConfig } from "@/lib/site-config";

interface ProfilePageProps {
  params: Promise<{ username: string }>;
}

const MAX_REVIEWS = 3;
const MAX_ACTIVITY = 5;

/**
 * Per-profile metadata: name + @username as the title, and a concise
 * description that falls back to the bio. The root layout supplies the
 * `%s · Favalog` template, so we pass the bare name. `openGraph.url` uses the
 * stable `/profile/[username]` route.
 */
export async function generateMetadata({
  params,
}: ProfilePageProps): Promise<Metadata> {
  const { username } = await params;
  const user = getUserByUsername(username);
  if (!user) {
    // Fall back to a real Supabase profile for non-mock usernames.
    if (isAuthAvailable()) {
      const profile = await getPublicProfileByUsername(username);
      if (profile) {
        const realDescription =
          profile.bio ??
          `${profile.displayName}'s Favalog on ${siteConfig.name}.`;
        return {
          title: `${profile.displayName} (@${profile.username})`,
          description: realDescription,
          openGraph: {
            type: "profile",
            title: `${profile.displayName} (@${profile.username}) on ${siteConfig.name}`,
            description: realDescription,
            url: `/profile/${profile.username}`,
            siteName: siteConfig.name,
          },
        };
      }
    }
    return { title: "Profile not found" };
  }

  const description =
    user.bio ??
    `${user.displayName}'s Favalog — the movies, TV, and books they watch, read, and love.`;
  const ogTitle = `${user.displayName} (@${user.username}) on ${siteConfig.name}`;

  return {
    title: `${user.displayName} (@${user.username})`,
    description,
    openGraph: {
      type: "profile",
      title: ogTitle,
      description,
      url: `/profile/${user.username}`,
      siteName: siteConfig.name,
      images: user.avatarUrl,
    },
    twitter: {
      card: "summary",
      title: ogTitle,
      description,
    },
  };
}

/**
 * A person's Favalog: one editorial, single-`h1` page that brings together
 * their identity, taste statistics, favorites, current and recent
 * consumption, reviews, lists, and social activity.
 *
 * Every value is read from the data layer (`@/lib/data`) — statistics are
 * derived selectors, not hardcoded totals, and all media/review/list/activity
 * records are referenced by id, never duplicated here. Unknown usernames use
 * `notFound()` so the site-wide `app/not-found.tsx` renders in the normal
 * chrome.
 */
export default async function ProfilePage({ params }: ProfilePageProps) {
  const { username } = await params;
  const user = getUserByUsername(username);
  if (!user) {
    // Transitional strategy: mock demo usernames render the full mock profile
    // above; a username that resolves to a REAL Supabase profile renders a
    // minimal identity layer with honest empty states. Everything else is a
    // genuine 404. A real user is never shown a mock user's activity.
    if (isAuthAvailable()) {
      const profile = await getPublicProfileByUsername(username);
      if (profile) {
        const viewer = await getCurrentUser();
        const isCurrentUser = viewer?.id === profile.id;

        // Derive the profile's real activity from its OWN diary/review rows.
        // A real profile never inherits mock data; when the read is
        // unavailable (no Supabase) or errors, we fall back to the minimal
        // identity view with honest empty states rather than faking activity.
        const activityResult = await getRealProfileActivity(profile.id);
        if (activityResult.status === "ok") {
          return (
            <RealProfile
              profile={profile}
              activity={activityResult.activity}
              isCurrentUser={isCurrentUser}
            />
          );
        }

        return (
          <RealProfileIdentity
            profile={profile}
            isCurrentUser={isCurrentUser}
          />
        );
      }
    }
    notFound();
  }

  const isCurrentUser = user.id === currentUserId;
  const firstName = user.displayName.split(" ")[0];

  const stats = getUserProfileStats(user.id);
  const favorites = getUserFavorites(user.id);
  const currentlyEnjoying = getUserCurrentlyEnjoying(user.id);
  const recentlyWatched = getUserRecentlyWatched(user.id);
  const recentlyRead = getUserRecentlyRead(user.id);
  const reviews = getReviewsByUser(user.id).slice(0, MAX_REVIEWS);
  const activity = getUserRecentActivity(user.id, MAX_ACTIVITY);
  const lists = getListsByUser(user.id)
    .map(toListCardView)
    .filter((list): list is NonNullable<typeof list> => list !== null);

  const statItems: ProfileStat[] = [
    { label: "Movies watched", value: stats.moviesWatched },
    { label: "Shows watched", value: stats.showsWatched },
    { label: "Books read", value: stats.booksRead },
    { label: "Reviews", value: stats.reviews },
    { label: "Lists", value: stats.lists },
    {
      label: "Average rating",
      value: stats.averageRating != null ? stats.averageRating.toFixed(1) : "—",
    },
  ];

  return (
    <Container className="flex flex-col gap-12 py-8 sm:gap-14 sm:py-10">
      <ProfileHeader
        user={user}
        isCurrentUser={isCurrentUser}
        coverMedia={favorites}
      />

      <section aria-label={`${firstName}'s statistics`}>
        <ProfileStats
          stats={statItems}
          label={`${firstName}'s statistics`}
          className="gap-x-10"
        />
      </section>

      <ProfileSection
        title="Favorites"
        description="A few titles that sum up their taste, across every format."
      >
        {favorites.length > 0 ? (
          <FavoriteMediaGrid items={favorites} />
        ) : (
          <EmptyState title={`${firstName} hasn't chosen any favorites yet.`} />
        )}
      </ProfileSection>

      {currentlyEnjoying.length > 0 && (
        <ProfileSection
          title="Currently enjoying"
          description={`What ${firstName} is watching and reading right now.`}
        >
          <FavoriteMediaGrid items={currentlyEnjoying} />
        </ProfileSection>
      )}

      {recentlyWatched.length > 0 && (
        <HorizontalMediaRow
          title="Recently watched"
          description="The latest films and series from their diary."
          items={recentlyWatched}
        />
      )}

      {recentlyRead.length > 0 && (
        <HorizontalMediaRow
          title="Recently read"
          description="The latest books from their diary."
          items={recentlyRead}
        />
      )}

      <ProfileSection
        title="Recent reviews"
        description={reviews.length > 0 ? "In their own words." : undefined}
      >
        {reviews.length > 0 ? (
          <ul className="grid gap-4 lg:grid-cols-2">
            {reviews.map((review) => {
              const media = getMediaById(review.mediaId);
              if (!media) return null;
              return (
                <li key={review.id}>
                  <ReviewCard review={review} user={user} media={media} />
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState
            icon={MessageSquare}
            title={`${firstName} hasn't written any reviews yet.`}
          />
        )}
      </ProfileSection>

      <ProfileSection
        title="Lists"
        description="Collections they've put together."
        href="/lists"
        linkLabel="Browse all lists"
      >
        {lists.length > 0 ? (
          <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {lists.map((list) => (
              <li key={list.id}>
                <ListCard list={list} />
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title={`${firstName} hasn't created any lists yet.`} />
        )}
      </ProfileSection>

      {activity.length > 0 && (
        <ProfileSection
          title="Recent activity"
          description="The latest from their Favalog."
        >
          <ul className="flex flex-col gap-3">
            {activity.map((item) => {
              const media = getMediaById(item.mediaId);
              if (!media) return null;
              return (
                <li key={item.id}>
                  <ActivityCard activity={item} user={user} media={media} />
                </li>
              );
            })}
          </ul>
        </ProfileSection>
      )}
    </Container>
  );
}
