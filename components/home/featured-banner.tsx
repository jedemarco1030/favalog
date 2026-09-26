import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { MediaItem } from "@/lib/types";
import { MediaPoster } from "@/components/media/media-poster";
import { mediaKindLabel } from "@/components/media/media-type-badge";

interface FeaturedBannerProps {
  item: MediaItem;
  /** Eyebrow describing WHY this title is shown (never a popularity claim). */
  eyebrow: string;
}

const CTA_LABEL: Record<MediaItem["kind"], string> = {
  movie: "View film",
  tv: "View series",
  book: "View book",
  game: "View game",
};

/**
 * One strong featured composition — no carousel, no autoplay. Wide backdrop
 * artwork gets a full-bleed treatment with a token-based scrim so text keeps
 * contrast in both themes; titles without a backdrop (most books) get an
 * intentional poster-beside-copy layout instead of a stretched cover.
 */
export function FeaturedBanner({ item, eyebrow }: FeaturedBannerProps) {
  const href = `/title/${item.slug}`;
  const kindLabel = mediaKindLabel(item.kind);
  const copy = (
    <>
      <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-accent">
        {eyebrow}
      </p>
      <p className="mt-3 flex items-center gap-2 text-xs uppercase tracking-wide text-foreground/60">
        <span>{kindLabel}</span>
        {item.year > 0 && (
          <>
            <span aria-hidden="true">·</span>
            <span className="tabular-nums">{item.year}</span>
          </>
        )}
      </p>
      <h2
        id="featured-heading"
        className="mt-2 text-balance font-display text-3xl leading-[1.05] tracking-tight text-foreground sm:text-4xl lg:text-5xl"
      >
        {item.title}
      </h2>
      {item.synopsis && (
        <p className="mt-3 line-clamp-3 max-w-md text-pretty text-sm leading-relaxed text-foreground/75 sm:text-base">
          {item.synopsis}
        </p>
      )}
      <Link
        href={href}
        className="mt-5 inline-flex w-fit items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        {CTA_LABEL[item.kind]}
        <span className="sr-only">: {item.title}</span>
        <ArrowUpRight className="size-4" aria-hidden="true" />
      </Link>
    </>
  );

  if (item.backdropUrl) {
    return (
      <section
        aria-labelledby="featured-heading"
        className="relative isolate overflow-hidden rounded-2xl border border-border/60 bg-surface-1"
      >
        <div className="relative aspect-[4/5] w-full sm:aspect-[16/9] lg:aspect-[21/9]">
          <Image
            src={item.backdropUrl}
            alt=""
            fill
            priority
            sizes="(min-width: 1280px) 1200px, 100vw"
            className="-z-10 object-cover object-[center_30%]"
          />
          <div
            aria-hidden="true"
            className="absolute inset-0 -z-10 bg-gradient-to-t from-background via-background/80 to-background/10 sm:bg-gradient-to-r sm:from-background sm:via-background/70 sm:to-transparent"
          />
          <div className="flex h-full flex-col justify-end p-6 sm:max-w-xl sm:p-10 lg:p-12">
            {copy}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section
      aria-labelledby="featured-heading"
      className="overflow-hidden rounded-2xl border border-border/60 bg-surface-1"
    >
      <div className="flex flex-col gap-6 p-6 sm:flex-row sm:items-end sm:gap-10 sm:p-10">
        <MediaPoster
          item={item}
          decorative
          priority
          sizes="(min-width: 640px) 208px, 160px"
          className="w-40 shrink-0 sm:w-52"
        />
        <div className="flex min-w-0 flex-col">{copy}</div>
      </div>
    </section>
  );
}
