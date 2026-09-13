import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Container } from "@/components/ui/container";
import { MediaCard } from "@/components/media/media-card";
import { MediaPoster } from "@/components/media/media-poster";
import { ActivityCard } from "@/components/activity/activity-card";
import { ReviewCard } from "@/components/reviews/review-card";
import { SectionHeader } from "@/components/ui/section-header";
import { FeedCard } from "@/components/feed/feed-card";
import {
  FeedErrorState,
  FeedNoActivityState,
  FeedNoFollowsState,
  FeedSignedOutState,
} from "@/components/feed/feed-states";
import {
  activity,
  books,
  getMediaById,
  getUserById,
  movies,
  recommendationShelves,
  reviews,
  tvShows,
} from "@/lib/data";
import type { MediaItem } from "@/lib/types";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { getFollowingFeedPreview } from "@/lib/supabase/feed";
import { getMyFollowingCount } from "@/lib/supabase/follows";
import { browseCatalog } from "@/lib/supabase/browse";

/** How many real catalog titles the honest "Explore the catalog" shelf shows. */
const CATALOG_SHELF_SIZE = 10;

/**
 * Pick a small, deterministic mix of movie / TV / book artwork for the
 * hero collage. Deterministic so the layout is stable on every render and
 * the same on server and client.
 */
function heroCollage(): MediaItem[] {
  const pick = (arr: MediaItem[], n: number) => arr.slice(0, n);
  return [...pick(movies, 2), ...pick(tvShows, 2), ...pick(books, 2)];
}

function exampleTrending(): MediaItem[] {
  // Interleave kinds so the row visibly mixes movies / TV / books.
  const zipped: MediaItem[] = [];
  const max = Math.max(movies.length, tvShows.length, books.length);
  for (let i = 0; i < max; i++) {
    if (movies[i]) zipped.push(movies[i]);
    if (tvShows[i]) zipped.push(tvShows[i]);
    if (books[i]) zipped.push(books[i]);
  }
  return zipped.slice(0, 10);
}

/**
 * Home.
 *
 * Configured mode is truthful: the only activity shown is the real following
 * feed preview, and the only catalog shelf is the real catalog. Favalog has no
 * trending signal, no likes, and no recommendation engine, so Home makes no
 * such claim — those sections exist only as clearly labelled examples in a
 * no-environment/demo build. A configured read failure is reported, never
 * papered over with mock activity. The decorative hero is unchanged.
 */
export default async function HomePage() {
  const collage = heroCollage();
  const configured = isSupabaseConfigured();

  return (
    <>
      {/* Hero */}
      <section
        aria-labelledby="hero-heading"
        className="relative overflow-hidden border-b border-border/60"
      >
        <Container className="py-16 md:py-20 lg:py-24">
          <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <div className="max-w-xl">
              <p className="text-[11px] uppercase tracking-[0.2em] text-accent">
                Favalog
              </p>
              <h1
                id="hero-heading"
                className="mt-4 font-display text-4xl leading-[1.05] tracking-tight text-foreground sm:text-5xl md:text-6xl"
              >
                Everything you watch and&nbsp;read.
              </h1>
              <p className="mt-5 max-w-lg text-base text-foreground/70 sm:text-lg">
                Track movies, shows, and books. Share what you love. Discover
                what comes next.
              </p>
              <div className="mt-7 flex flex-wrap items-center gap-3">
                <Link
                  href="/explore"
                  className="inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  Start your Favalog
                  <ArrowUpRight className="size-4" aria-hidden="true" />
                </Link>
                <Link
                  href="/explore"
                  className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-surface-1 px-5 py-2.5 text-sm font-medium text-foreground/80 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  Explore
                </Link>
              </div>
            </div>

            {/* Hero collage: mixed posters staggered, decorative. */}
            <div
              aria-hidden="true"
              className="relative mx-auto hidden aspect-[5/4] w-full max-w-md sm:block lg:mx-0 lg:max-w-none"
            >
              <div className="absolute left-[2%] top-[8%] w-[30%] rotate-[-6deg]">
                <MediaPoster
                  item={collage[0]}
                  sizes="200px"
                  decorative
                  priority
                />
              </div>
              <div className="absolute left-[24%] top-0 w-[30%] rotate-[3deg]">
                <MediaPoster item={collage[2]} sizes="200px" decorative />
              </div>
              <div className="absolute left-[48%] top-[6%] w-[30%] rotate-[-2deg]">
                <MediaPoster item={collage[4]} sizes="200px" decorative />
              </div>
              <div className="absolute left-[10%] top-[42%] w-[30%] rotate-[4deg]">
                <MediaPoster item={collage[1]} sizes="200px" decorative />
              </div>
              <div className="absolute left-[36%] top-[46%] w-[30%] rotate-[-4deg]">
                <MediaPoster item={collage[3]} sizes="200px" decorative />
              </div>
              <div className="absolute left-[60%] top-[44%] w-[30%] rotate-[6deg]">
                <MediaPoster item={collage[5]} sizes="200px" decorative />
              </div>
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background via-background/10 to-transparent" />
            </div>
          </div>
        </Container>
      </section>

      {configured ? (
        <>
          <FollowingFeedPreview />
          <ExploreCatalogShelf />
        </>
      ) : (
        <ExampleSections />
      )}

      {/* Discovery / profile CTA */}
      <Container className="pb-24 pt-4">
        <section
          aria-labelledby="cta-heading"
          className="rounded-2xl border border-border/60 bg-surface-1 px-6 py-10 sm:px-10"
        >
          <div className="flex flex-col items-start gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="max-w-xl">
              <h2
                id="cta-heading"
                className="font-display text-3xl leading-tight tracking-tight text-foreground"
              >
                Build your Favalog.
              </h2>
              <p className="mt-2 text-foreground/70">
                Keep the movies, shows, and books that matter to you in one
                place.
              </p>
            </div>
            <Link
              href="/explore"
              className="inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              Start your Favalog
              <ArrowUpRight className="size-4" aria-hidden="true" />
            </Link>
          </div>
        </section>
      </Container>
    </>
  );
}

/**
 * The real following feed preview — the same read `/feed` uses, with a smaller
 * bound, so Home can never disagree with the feed. Every state is told
 * truthfully and mock activity is never substituted for a failed read.
 */
async function FollowingFeedPreview() {
  const page = await getFollowingFeedPreview();
  // `unavailable` cannot happen here (this section only renders when Supabase
  // is configured), but it is handled as an error rather than as emptiness.

  return (
    <Container className="py-16">
      <section aria-label="From your circle">
        <SectionHeader
          title="From your circle"
          description="What the people you follow are watching, reading, and rating."
          href="/feed"
          linkLabel="View all"
          as="h2"
        />
        {page.status === "signed-out" ? (
          <FeedSignedOutState returnTo="/feed" />
        ) : page.status === "ok" ? (
          page.items.length > 0 ? (
            <ul role="list" className="grid gap-3 sm:grid-cols-2">
              {page.items.map((item) => (
                <li key={item.key}>
                  <FeedCard item={item} />
                </li>
              ))}
            </ul>
          ) : (
            <FollowingFeedEmptyState />
          )
        ) : (
          <FeedErrorState retryHref="/" />
        )}
      </section>
    </Container>
  );
}

/** An empty feed has two different causes; read the real relationship count. */
async function FollowingFeedEmptyState() {
  const followingCount = await getMyFollowingCount();
  return followingCount === 0 ? (
    <FeedNoFollowsState />
  ) : (
    <FeedNoActivityState />
  );
}

/**
 * The one honest catalog shelf: the real `media_items` catalog through the
 * existing browse reader. No popularity claim is made, and when the read is
 * unavailable or fails the shelf is simply omitted — never mock-substituted.
 */
async function ExploreCatalogShelf() {
  const outcome = await browseCatalog({ sort: "recently_added" });
  if (outcome.status !== "ok" || outcome.items.length === 0) return null;
  const items = outcome.items.slice(0, CATALOG_SHELF_SIZE);

  return (
    <Container className="pb-16">
      <section aria-label="Explore the catalog">
        <SectionHeader
          title="Explore the catalog"
          description="Movies, shows, and books in Favalog's catalog, most recently added first."
          href="/explore"
          linkLabel="Browse all"
          as="h2"
        />
        <ul
          role="list"
          className="grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 lg:grid-cols-5"
        >
          {items.map((item) => (
            <li key={item.id}>
              <MediaCard item={item} />
            </li>
          ))}
        </ul>
      </section>
    </Container>
  );
}

/**
 * No-environment/demo mode only: clearly labelled example content so the
 * landing page still demonstrates the product without a live Favalog. None of
 * it is presented as real popularity, activity, or personalization.
 */
function ExampleSections() {
  const trending = exampleTrending();
  const circle = activity.slice(0, 6);
  const popularReviews = [...reviews]
    .sort((a, b) => b.likeCount - a.likeCount)
    .slice(0, 4);
  const shelf = recommendationShelves[0];
  const seed = shelf ? getMediaById(shelf.seedMediaId) : undefined;
  const recommendations = shelf
    ? shelf.mediaIds
        .map((id) => getMediaById(id))
        .filter((m): m is MediaItem => Boolean(m))
    : [];

  return (
    <>
      <Container className="py-16">
        <section aria-label="Example titles">
          <SectionHeader
            title="Example titles"
            description="Sample movies, shows, and books shown while no Favalog environment is connected."
            href="/explore"
            linkLabel="Explore"
            as="h2"
          />
          <ul
            role="list"
            className="grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 lg:grid-cols-5"
          >
            {trending.map((item, index) => (
              <li key={item.id}>
                <MediaCard item={item} priority={index === 0} />
              </li>
            ))}
          </ul>
        </section>
      </Container>

      <Container className="pb-16">
        <section aria-label="Example activity">
          <SectionHeader
            title="Example activity"
            description="An illustration of how a following feed looks. Nobody here is a real Favalog account."
            href="/feed"
            linkLabel="View all"
            as="h2"
          />
          <ul role="list" className="grid gap-3 sm:grid-cols-2">
            {circle.map((entry) => {
              const user = getUserById(entry.userId);
              const media = getMediaById(entry.mediaId);
              if (!user || !media) return null;
              return (
                <li key={entry.id}>
                  <ActivityCard activity={entry} user={user} media={media} />
                </li>
              );
            })}
          </ul>
        </section>
      </Container>

      <Container className="pb-16">
        <section aria-label="Example reviews">
          <SectionHeader
            title="Example reviews"
            description="Sample writing across films, series, and books."
            as="h2"
          />
          <ul role="list" className="grid gap-4 md:grid-cols-2">
            {popularReviews.map((review) => {
              const user = getUserById(review.userId);
              const media = getMediaById(review.mediaId);
              if (!user || !media) return null;
              return (
                <li key={review.id}>
                  <ReviewCard review={review} user={user} media={media} />
                </li>
              );
            })}
          </ul>
        </section>
      </Container>

      {seed && recommendations.length > 0 && (
        <Container className="pb-16">
          <section aria-label="Example related titles">
            <SectionHeader
              title="Example related titles"
              description={`A sample mix that tends to travel with ${seed.title}.`}
              as="h2"
            />
            <ul
              role="list"
              className="grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 lg:grid-cols-5"
            >
              {recommendations.map((item) => (
                <li key={item.id}>
                  <MediaCard item={item} />
                </li>
              ))}
            </ul>
          </section>
        </Container>
      )}
    </>
  );
}
