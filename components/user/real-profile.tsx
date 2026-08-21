import Link from "next/link";
import { CalendarDays, MapPin, MessageSquare } from "lucide-react";
import { Container } from "@/components/ui/container";
import { EmptyState } from "@/components/ui/empty-state";
import { ProfileSection } from "@/components/user/profile-section";
import { ProfileAvatar } from "@/components/user/profile-avatar";
import {
  ProfileStats,
  type ProfileStat,
} from "@/components/user/profile-stats";
import { HorizontalMediaRow } from "@/components/media/horizontal-media-row";
import { FavoriteMediaGrid } from "@/components/user/favorite-media-grid";
import { MediaTypeBadge } from "@/components/media/media-type-badge";
import { StarRating } from "@/components/ui/star-rating";
import { RealListCard } from "@/components/lists/real-list-card";
import type { Profile } from "@/lib/types";
import type { RealProfileActivity } from "@/lib/supabase/profile-activity";
import type { ProfileListsResult } from "@/lib/supabase/lists";
import type { ProfileFavoritesResult } from "@/lib/supabase/favorites";

const joinedFormatter = new Intl.DateTimeFormat("en", {
  month: "long",
  year: "numeric",
});
const reviewDateFormatter = new Intl.DateTimeFormat("en", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

interface RealProfileProps {
  profile: Profile;
  activity: RealProfileActivity;
  /**
   * The profile owner's real lists, visibility-scoped by RLS (a non-owner sees
   * only public lists; the owner sees all of theirs). Never mock data.
   */
  lists: ProfileListsResult;
  /**
   * The profile owner's real favorites, ordered by position. Favorites are
   * publicly readable (the documented RLS model), so a visitor sees them too.
   * Never mock data.
   */
  favorites: ProfileFavoritesResult;
  /** True when this is the signed-in viewer's own profile. */
  isCurrentUser?: boolean;
}

/**
 * A real (Supabase-backed) public profile with derived activity.
 *
 * Every number and list here comes from the profile owner's OWN diary and
 * review rows (via `getRealProfileActivity`) — never from the mock layer, so a
 * real user is never attributed mock data. Statistics are derived, not stored;
 * a linked review's rating is its diary entry's rating (already resolved in the
 * read layer); and no fabricated like counts are shown for real reviews. Real
 * lists and favorites are now wired (favorites are publicly readable; lists are
 * visibility-scoped by RLS). The remaining not-yet-migrated social surface
 * (follows) is shown as an honest deferred note rather than faked.
 */
export function RealProfile({
  profile,
  activity,
  lists,
  favorites,
  isCurrentUser = false,
}: RealProfileProps) {
  const { stats, recentlyWatched, recentlyRead, reviews } = activity;
  const firstName = profile.displayName.split(" ")[0] || profile.displayName;

  // The list count derives only from permitted real rows (RLS-scoped).
  const listCount = lists.status === "ok" ? lists.lists.length : null;

  const statItems: ProfileStat[] = [
    { label: "Movies watched", value: stats.moviesWatched },
    { label: "Shows watched", value: stats.tvWatched },
    { label: "Books read", value: stats.booksRead },
    { label: "Reviews", value: stats.reviews },
    ...(listCount != null
      ? [{ label: "Lists", value: listCount } satisfies ProfileStat]
      : []),
    {
      label: "Average rating",
      value: stats.averageRating != null ? stats.averageRating.toFixed(1) : "—",
    },
  ];

  return (
    <Container className="flex flex-col gap-12 py-8 sm:gap-14 sm:py-10">
      <header className="relative overflow-hidden rounded-2xl border border-border/60 bg-surface-1 px-5 py-8 sm:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <ProfileAvatar
            displayName={profile.displayName}
            avatarUrl={profile.avatarUrl}
            size="xl"
            className="shrink-0 ring-4 ring-surface-1"
          />
          <div className="flex flex-col gap-2">
            <div>
              <h1 className="font-display text-3xl tracking-tight text-foreground sm:text-4xl">
                {profile.displayName}
              </h1>
              <p className="text-sm text-foreground/50">@{profile.username}</p>
            </div>

            {profile.bio && (
              <p className="max-w-prose text-sm leading-relaxed text-foreground/75">
                {profile.bio}
              </p>
            )}

            <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-foreground/50">
              {profile.location && (
                <li className="inline-flex items-center gap-1">
                  <MapPin className="size-3.5" aria-hidden="true" />
                  {profile.location}
                </li>
              )}
              <li className="inline-flex items-center gap-1">
                <CalendarDays className="size-3.5" aria-hidden="true" />
                Joined{" "}
                <time dateTime={profile.createdAt}>
                  {joinedFormatter.format(new Date(profile.createdAt))}
                </time>
              </li>
            </ul>
          </div>
        </div>
      </header>

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
        {favorites.status === "ok" ? (
          favorites.favorites.length > 0 ? (
            <FavoriteMediaGrid
              items={favorites.favorites.map((favorite) => favorite.media)}
            />
          ) : (
            <EmptyState
              title={
                isCurrentUser
                  ? "You haven't chosen any favorites yet."
                  : `${firstName} hasn't chosen any favorites yet.`
              }
              description={
                isCurrentUser
                  ? "Open a title and tap Favorite to start your shelf."
                  : undefined
              }
            />
          )
        ) : (
          <EmptyState
            title="Favorites couldn't be loaded right now."
            description="Please try again in a moment."
          />
        )}
      </ProfileSection>

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
            {reviews.slice(0, 6).map((review) => (
              <li key={review.id}>
                <article className="flex flex-col gap-3 rounded-xl border border-border/60 bg-surface-1 p-5">
                  <header className="flex items-center justify-between gap-3">
                    <time
                      dateTime={review.createdAt}
                      className="text-xs text-foreground/50"
                    >
                      {reviewDateFormatter.format(new Date(review.createdAt))}
                    </time>
                    {review.rating != null && (
                      <StarRating value={review.rating} showNumeric />
                    )}
                  </header>
                  {review.title && (
                    <h3 className="font-display text-lg leading-snug text-foreground">
                      {review.title}
                    </h3>
                  )}
                  <p
                    className={
                      review.containsSpoilers
                        ? "text-sm italic text-foreground/75"
                        : "text-sm text-foreground/75"
                    }
                  >
                    {review.body}
                  </p>
                  <footer className="mt-1 text-xs text-foreground/50">
                    <Link
                      href={`/title/${review.media.slug}`}
                      className="inline-flex items-center gap-2 rounded outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent"
                    >
                      <MediaTypeBadge kind={review.media.kind} />
                      <span className="truncate">{review.media.title}</span>
                    </Link>
                  </footer>
                </article>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            icon={MessageSquare}
            title={
              isCurrentUser
                ? "You haven't written any reviews yet."
                : `${firstName} hasn't written any reviews yet.`
            }
          />
        )}
      </ProfileSection>

      <ProfileSection
        title="Lists"
        description="Collections they've put together."
      >
        {lists.status === "ok" ? (
          lists.lists.length > 0 ? (
            <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {lists.lists.map((list) => (
                <li key={list.id}>
                  {/* Owner sees public/private status; visitors see only
                      public lists (RLS-scoped) so no badge is needed. */}
                  <RealListCard list={list} showVisibility={isCurrentUser} />
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              title={
                isCurrentUser
                  ? "You haven't created any lists yet."
                  : `${firstName} hasn't created any lists yet.`
              }
            />
          )
        ) : (
          <EmptyState
            title="Lists couldn't be loaded right now."
            description="Please try again in a moment."
          />
        )}
      </ProfileSection>

      <ProfileSection title="More on their Favalog">
        <EmptyState
          title="Follows are coming soon."
          description="Following people isn't wired up to accounts yet."
        />
      </ProfileSection>
    </Container>
  );
}
