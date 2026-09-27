import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowUpRight } from "lucide-react";
import type { MediaItem, MediaKind } from "@/lib/types";
import { ArtworkImage } from "@/components/media/artwork-image";
import { MediaPoster } from "@/components/media/media-poster";
import { mediaKindLabel } from "@/components/media/media-type-badge";
import { displayableArtwork } from "@/lib/media/artwork";

/** What the banner shows. Built from a canonical title or a provider candidate. */
export interface FeaturedDisplay {
  title: string;
  kind: MediaKind;
  year?: number;
  synopsis?: string;
  posterUrl?: string;
  backdropUrl?: string;
}

interface FeaturedBannerProps {
  item: FeaturedDisplay;
  /** Eyebrow describing WHY this title is shown, e.g. "Trending on TMDB". */
  eyebrow: string;
  /** The primary action: a link to details, or the discovery Open/Save controls. */
  cta: ReactNode;
}

const CTA_LABEL: Record<MediaKind, string> = {
  movie: "View film",
  tv: "View series",
  book: "View book",
  game: "View game",
};

/** The banner CTA for a title that already exists in Favalog. */
export function FeaturedTitleLink({ item }: { item: MediaItem }) {
  return (
    <Link
      href={`/title/${item.slug}`}
      className="inline-flex w-fit items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      {CTA_LABEL[item.kind]}
      <span className="sr-only">: {item.title}</span>
      <ArrowUpRight className="size-4" aria-hidden="true" />
    </Link>
  );
}

/**
 * One strong featured composition, with no carousel and no autoplay. Only real
 * provider backdrops get the full-bleed treatment; a portrait poster is never
 * stretched into a wide banner, it sits beside the copy instead. A backdrop that
 * fails to load leaves the surface and copy intact.
 */
export function FeaturedBanner({ item, eyebrow, cta }: FeaturedBannerProps) {
  const backdrop = displayableArtwork(item.backdropUrl);
  const copy = (
    <>
      <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-accent">
        {eyebrow}
      </p>
      <p className="mt-3 flex items-center gap-2 text-xs uppercase tracking-wide text-foreground/60">
        <span>{mediaKindLabel(item.kind)}</span>
        {item.year ? (
          <>
            <span aria-hidden="true">·</span>
            <span className="tabular-nums">{item.year}</span>
          </>
        ) : null}
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
      <div className="mt-5">{cta}</div>
    </>
  );

  if (backdrop) {
    return (
      <section
        aria-labelledby="featured-heading"
        className="relative isolate overflow-hidden rounded-2xl border border-border/60 bg-surface-1"
      >
        <div className="relative aspect-[4/5] w-full sm:aspect-[16/9] lg:aspect-[21/9]">
          <ArtworkImage
            src={backdrop}
            alt=""
            priority
            sizes="(min-width: 1280px) 1200px, 100vw"
            className="-z-10 object-cover object-[center_30%]"
            fallback={null}
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
          item={{ title: item.title, posterUrl: item.posterUrl ?? "" }}
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
