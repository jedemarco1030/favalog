import { Suspense } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Container } from "@/components/ui/container";
import { MediaCard } from "@/components/media/media-card";
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
import { FeaturedBanner } from "@/components/home/featured-banner";
import { ReleaseShelf } from "@/components/home/release-shelf";
import { KindShelf } from "@/components/home/kind-shelf";
import { HomeSources } from "@/components/home/home-sources";
import { ShelfSkeleton } from "@/components/home/shelf-skeleton";
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
import type { MediaItem, MediaKind } from "@/lib/types";
import type { ExternalProvider } from "@/lib/catalog/types";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { getFollowingFeedPreview } from "@/lib/supabase/feed";
import { getMyFollowingCount } from "@/lib/supabase/follows";
import { getCurrentUser } from "@/lib/auth/data";
import {
  readFeaturedCandidates,
  readRecentlyAdded,
  readReleaseWindow,
  type HomeRead,
} from "@/lib/supabase/home";
import { FEATURED_SLUGS, pickFeatured, utcDayIndex } from "@/lib/home/featured";
import {
  RELEASE_SHELF_LIMIT,
  releaseWindowStartYear,
  selectReleaseShelf,
} from "@/lib/home/releases";

/** Media-type shelves, in display order, with how many titles each shows. */
const KIND_SHELVES: ReadonlyArray<{ kind: MediaKind; limit: number }> = [
  { kind: "movie", limit: 5 },
  { kind: "tv", limit: 5 },
  { kind: "book", limit: 5 },
  { kind: "game", limit: 3 },
];

/** Release candidates read before year filtering; bounded by HOME_READ_MAX. */
const RELEASE_READ_LIMIT = 24;

function mixedExampleTitles(): MediaItem[] {
  const zipped: MediaItem[] = [];
  const max = Math.max(movies.length, tvShows.length, books.length);
  for (let i = 0; i < max; i++) {
    if (movies[i]) zipped.push(movies[i]);
    if (tvShows[i]) zipped.push(tvShows[i]);
    if (books[i]) zipped.push(books[i]);
  }
  return zipped;
}

/**
 * Home.
 *
 * Artwork-forward and truthful. Configured mode reads only Favalog's own
 * catalog (never a live provider call), with every section streamed behind a
 * dimension-reserving skeleton so a slow read cannot block the page or shift
 * layout. No section claims popularity or trending: the banner is an editor's
 * pick, shelves are "recently added", and releases are by stored year. A
 * signed-in visitor sees their following feed right after the banner; a
 * signed-out visitor gets discovery first and the sign-in prompt later. Demo
 * mode (no environment) keeps clearly labelled example content.
 */
export default async function HomePage() {
  const configured = isSupabaseConfigured();
  const signedIn = configured ? Boolean(await getCurrentUser()) : false;
  const now = new Date();
  const currentYear = now.getUTCFullYear();
  const dayIndex = utcDayIndex(now);

  return (
    <>
      <HomeIntro />

      {configured ? (
        <>
          <Container className="pt-2">
            <Suspense fallback={<FeaturedSkeleton />}>
              <FeaturedSection dayIndex={dayIndex} />
            </Suspense>
          </Container>

          {signedIn && <FollowingFeedPreview />}

          <Container className="flex flex-col gap-16 py-16">
            <Suspense fallback={<ShelfSkeleton label="releases" />}>
              <ReleaseSection currentYear={currentYear} />
            </Suspense>
            {KIND_SHELVES.map(({ kind, limit }) => (
              <Suspense
                key={kind}
                fallback={
                  <ShelfSkeleton
                    label={`${kind} shelf`}
                    count={limit}
                    artwork={kind === "game" ? "landscape" : "poster"}
                  />
                }
              >
                <KindSection kind={kind} limit={limit} />
              </Suspense>
            ))}
          </Container>

          {!signedIn && <FollowingFeedPreview />}

          <Container className="pb-8">
            <Suspense fallback={null}>
              <SourcesSection currentYear={currentYear} />
            </Suspense>
          </Container>
        </>
      ) : (
        <ExampleSections dayIndex={dayIndex} />
      )}

      <Container className="pb-24 pt-8">
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
              <p className="mt-2 leading-relaxed text-foreground/70">
                Keep the films, series, books, and games that matter to you in
                one place.
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

const MEDIA_TYPE_LINKS: ReadonlyArray<{ kind: MediaKind; label: string }> = [
  { kind: "movie", label: "Films" },
  { kind: "tv", label: "Series" },
  { kind: "book", label: "Books" },
  { kind: "game", label: "Games" },
];

/** Compact intro: the artwork below carries the page, not a mock collage. */
function HomeIntro() {
  return (
    <Container className="flex flex-col gap-6 pb-8 pt-12 md:flex-row md:items-end md:justify-between md:pt-16">
      <div className="max-w-2xl">
        <h1 className="text-balance font-display text-4xl leading-[1.05] tracking-tight text-foreground sm:text-5xl">
          Everything you watch, read, and&nbsp;play.
        </h1>
        <p className="mt-4 max-w-lg text-pretty leading-relaxed text-foreground/70">
          Track films, series, books, and games. Share what you love. Discover
          what comes next.
        </p>
      </div>
      <nav aria-label="Browse by media type">
        <ul role="list" className="flex flex-wrap gap-2">
          {MEDIA_TYPE_LINKS.map(({ kind, label }) => (
            <li key={kind}>
              <Link
                href={`/explore?type=${kind}`}
                className="inline-flex items-center rounded-full border border-border/70 bg-surface-1 px-4 py-2 text-sm text-foreground/80 transition-colors hover:border-accent/50 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </Container>
  );
}

function FeaturedSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading featured title"
      className="aspect-[4/5] w-full rounded-2xl bg-surface-1 motion-safe:animate-pulse sm:aspect-[16/9] lg:aspect-[21/9]"
    />
  );
}

async function FeaturedSection({ dayIndex }: { dayIndex: number }) {
  let read = await readFeaturedCandidates(FEATURED_SLUGS);
  if (read.status === "ok" && read.items.length === 0) {
    read = await readRecentlyAdded(12);
  }
  if (read.status !== "ok") return null;
  const pick = pickFeatured(read.items, dayIndex);
  if (!pick) return null;
  return (
    <FeaturedBanner
      item={pick.item}
      eyebrow={pick.curated ? "Editor's pick" : "From the catalog"}
    />
  );
}

async function ReleaseSection({ currentYear }: { currentYear: number }) {
  const read = await readReleaseWindow(
    releaseWindowStartYear(currentYear),
    RELEASE_READ_LIMIT,
  );
  if (read.status !== "ok") return null;
  const shelf = selectReleaseShelf(
    read.items,
    currentYear,
    RELEASE_SHELF_LIMIT,
  );
  return <ReleaseShelf shelf={shelf} currentYear={currentYear} />;
}

async function KindSection({
  kind,
  limit,
}: {
  kind: MediaKind;
  limit: number;
}) {
  const read = await readRecentlyAdded(limit, kind);
  if (read.status !== "ok") return null;
  return <KindShelf kind={kind} items={read.items} />;
}

/**
 * Credits every provider whose data the sections above displayed. The reads
 * are request-memoized, so this repeats no database work.
 */
async function SourcesSection({ currentYear }: { currentYear: number }) {
  const [featured, releases, ...shelves] = await Promise.all([
    readFeaturedCandidates(FEATURED_SLUGS),
    readReleaseWindow(releaseWindowStartYear(currentYear), RELEASE_READ_LIMIT),
    ...KIND_SHELVES.map(({ kind, limit }) => readRecentlyAdded(limit, kind)),
  ]);
  const providers = new Set<ExternalProvider>();
  for (const read of [featured, releases, ...shelves] as HomeRead[]) {
    if (read.status === "ok") read.providers.forEach((p) => providers.add(p));
  }
  return <HomeSources providers={[...providers]} />;
}

/**
 * The real following feed preview — the same read `/feed` uses, with a smaller
 * bound, so Home can never disagree with the feed. Every state is told
 * truthfully and mock activity is never substituted for a failed read.
 */
async function FollowingFeedPreview() {
  const page = await getFollowingFeedPreview();

  return (
    <Container className="py-16">
      <section aria-label="From your circle">
        <SectionHeader
          title="From your circle"
          description="What the people you follow are watching, reading, playing, and rating."
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
 * No-environment/demo mode only: clearly labelled example content so the
 * landing page still demonstrates the product without a live Favalog. None of
 * it is presented as real popularity, activity, or personalization.
 */
function ExampleSections({ dayIndex }: { dayIndex: number }) {
  const examples = mixedExampleTitles();
  const featured = pickFeatured(examples, dayIndex, []);
  const circle = activity.slice(0, 6);
  const exampleReviews = [...reviews]
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
      {featured && (
        <Container className="pt-2">
          <FeaturedBanner item={featured.item} eyebrow="Example title" />
        </Container>
      )}

      <Container className="py-16">
        <section aria-label="Example titles">
          <SectionHeader
            title="Example titles"
            description="Sample films, series, and books shown while no Favalog environment is connected."
            href="/explore"
            linkLabel="Explore"
            as="h2"
          />
          <ul
            role="list"
            className="grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 lg:grid-cols-5"
          >
            {examples.slice(0, 10).map((item) => (
              <li key={item.id}>
                <MediaCard item={item} />
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
            {exampleReviews.map((review) => {
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
