import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Container } from "@/components/ui/container";
import { HorizontalMediaRow } from "@/components/media/horizontal-media-row";
import { ActivityCard } from "@/components/activity/activity-card";
import { SectionHeader } from "@/components/ui/section-header";
import {
  activity,
  books,
  getMediaById,
  getUserById,
  mediaItems,
  movies,
  tvShows,
} from "@/lib/data";
import type { MediaItem } from "@/lib/types";

function pickFeatured(): MediaItem {
  // Prefer an item with a backdrop; deterministic for a stable hero on refresh.
  return mediaItems.find((item) => item.backdropUrl) ?? mediaItems[0];
}

export default function HomePage() {
  const featured = pickFeatured();
  const recentActivity = activity.slice(0, 4);

  return (
    <>
      {/* Hero */}
      <section
        aria-label="Welcome to Favalog"
        className="relative overflow-hidden border-b border-border/60"
      >
        {featured.backdropUrl && (
          <div className="absolute inset-0 -z-10" aria-hidden="true">
            <Image
              src={featured.backdropUrl}
              alt=""
              fill
              priority
              sizes="100vw"
              className="object-cover opacity-40"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/85 to-background/40" />
          </div>
        )}
        <Container className="py-24 md:py-32">
          <div className="max-w-2xl">
            <p className="text-[11px] uppercase tracking-[0.2em] text-accent">
              Favalog
            </p>
            <h1 className="mt-4 font-display text-5xl leading-[1.05] tracking-tight text-foreground md:text-6xl">
              Everything you watch and&nbsp;read.
              <br />
              <span className="text-accent">One place to remember it.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg text-foreground/70">
              A social home for films, series, and books. Rate them, review
              them, keep them somewhere better than a notes app.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href="/explore"
                className="inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                Start exploring
                <ArrowUpRight className="size-4" aria-hidden="true" />
              </Link>
              <Link
                href="/diary"
                className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-surface-1 px-5 py-2.5 text-sm font-medium text-foreground/80 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                See your diary
              </Link>
            </div>
          </div>
        </Container>
      </section>

      <Container className="py-16">
        <HorizontalMediaRow
          title="New films"
          description="Recent additions worth an evening."
          items={movies}
          href="/explore?type=movies"
          priorityFirst
        />
      </Container>

      <Container className="pb-16">
        <HorizontalMediaRow
          title="Series in rotation"
          description="What people are watching this week."
          items={tvShows}
          href="/explore?type=tv"
        />
      </Container>

      <Container className="pb-16">
        <HorizontalMediaRow
          title="Books worth remembering"
          description="Short shelves, long reads."
          items={books}
          href="/explore?type=books"
        />
      </Container>

      <Container className="pb-16">
        <SectionHeader
          title="Latest from your feed"
          description="Ratings, reviews, and finishes from people you follow."
          href="/diary"
          linkLabel="View all"
        />
        <ul role="list" className="grid gap-3 sm:grid-cols-2">
          {recentActivity.map((entry) => {
            const user = getUserById(entry.userId);
            const media = getMediaById(entry.mediaId);
            if (!user || !media) return null;
            return (
              <li key={entry.id}>
                <ActivityCard
                  activity={entry}
                  user={user}
                  media={media}
                />
              </li>
            );
          })}
        </ul>
      </Container>
    </>
  );
}
