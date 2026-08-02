import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Container } from "@/components/ui/container";
import { MediaCard } from "@/components/media/media-card";
import { ActivityCard } from "@/components/activity/activity-card";
import { Badge } from "@/components/ui/badge";
import {
  activity,
  getMediaById,
  getUserById,
  mediaItems,
  movies,
  books,
  tvShows,
} from "@/lib/data";
import type { MediaItem } from "@/lib/types";

function pickFeatured(): MediaItem {
  // Prefer an item with a backdrop; deterministic for stable hero.
  return mediaItems.find((item) => item.backdropUrl) ?? mediaItems[0];
}

export default function HomePage() {
  const featured = pickFeatured();
  const recentActivity = activity.slice(0, 4);

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border/60">
        {featured.backdropUrl && (
          <div className="absolute inset-0 -z-10">
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
            <Badge tone="accent">Frontend MVP · Mock data</Badge>
            <h1 className="mt-6 font-display text-5xl leading-[1.05] tracking-tight text-foreground md:text-6xl">
              Everything you watch and&nbsp;read.
              <br />
              <span className="text-accent">One place to remember it.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg text-foreground/70">
              Lorely is a social home for films, series, and books. Rate them,
              review them, keep them somewhere better than a notes app.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href="/join"
                className="inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                Start tracking
                <ArrowUpRight className="size-4" aria-hidden="true" />
              </Link>
              <Link
                href="/activity"
                className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-surface-1 px-5 py-2.5 text-sm font-medium text-foreground/80 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                See what people are watching
              </Link>
            </div>
          </div>
        </Container>
      </section>

      <Container className="py-16">
        <MediaRow title="New films" href="/films" items={movies} />
      </Container>

      <Container className="pb-16">
        <MediaRow title="Series in rotation" href="/series" items={tvShows} />
      </Container>

      <Container className="pb-16">
        <MediaRow title="Books worth remembering" href="/books" items={books} />
      </Container>

      <Container className="pb-16">
        <div className="mb-6 flex items-end justify-between">
          <div>
            <h2 className="font-display text-2xl tracking-tight text-foreground">
              Latest from your feed
            </h2>
            <p className="mt-1 text-sm text-foreground/60">
              Ratings, reviews, and finishes from people you follow.
            </p>
          </div>
          <Link
            href="/activity"
            className="hidden text-sm text-foreground/70 hover:text-foreground sm:inline-flex sm:items-center sm:gap-1"
          >
            View all <ArrowUpRight className="size-4" aria-hidden="true" />
          </Link>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {recentActivity.map((entry) => {
            const user = getUserById(entry.userId);
            const media = getMediaById(entry.mediaId);
            if (!user || !media) return null;
            return (
              <ActivityCard
                key={entry.id}
                activity={entry}
                user={user}
                media={media}
              />
            );
          })}
        </div>
      </Container>
    </>
  );
}

interface MediaRowProps {
  title: string;
  href: string;
  items: MediaItem[];
}

function MediaRow({ title, href, items }: MediaRowProps) {
  return (
    <section>
      <div className="mb-6 flex items-end justify-between gap-4">
        <h2 className="font-display text-2xl tracking-tight text-foreground">
          {title}
        </h2>
        <Link
          href={href}
          className="inline-flex items-center gap-1 text-sm text-foreground/70 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          Browse all <ArrowUpRight className="size-4" aria-hidden="true" />
        </Link>
      </div>
      <div className="grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 lg:grid-cols-5">
        {items.map((item) => (
          <MediaCard key={item.id} item={item} />
        ))}
      </div>
    </section>
  );
}
