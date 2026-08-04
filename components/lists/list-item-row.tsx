import Link from "next/link";
import type { MediaItem } from "@/lib/types";
import { MediaPoster } from "@/components/media/media-poster";
import {
  MediaTypeBadge,
  mediaKindLabel,
} from "@/components/media/media-type-badge";
import { RatingDisplay } from "@/components/ui/rating-display";
import { cn } from "@/lib/cn";

interface ListItemRowProps {
  item: MediaItem;
  /** 1-based position, shown only for ranked lists. */
  rank?: number;
  /** Optional short curator note for this title within the list. */
  note?: string;
  className?: string;
}

/**
 * One row in a list's contents: an optional rank, cover artwork, the title
 * with its year and media type, a community rating, and an optional curator
 * note. Works for every `MediaItem` kind — movies, TV, and books share this
 * one row rather than each getting a bespoke renderer.
 *
 * Both the artwork and the title link to the unified `/title/[slug]` page.
 */
export function ListItemRow({ item, rank, note, className }: ListItemRowProps) {
  const href = `/title/${item.slug}`;
  const kindLabel = mediaKindLabel(item.kind);

  return (
    <article className={cn("flex gap-4 sm:gap-5", className)}>
      {rank != null && (
        <span
          aria-hidden="true"
          className="w-6 shrink-0 pt-1 text-right font-display text-lg text-foreground/40 tabular-nums sm:w-8 sm:text-xl"
        >
          {rank}
        </span>
      )}

      <Link
        href={href}
        aria-label={`View ${item.title}`}
        tabIndex={-1}
        className="shrink-0 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <MediaPoster
          item={item}
          sizes="64px"
          decorative
          className="w-14 rounded-md sm:w-16"
        />
      </Link>

      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-foreground/50">
          <MediaTypeBadge kind={item.kind} />
          <span className="tabular-nums">{item.year}</span>
        </div>

        <h3 className="font-display text-base leading-snug text-foreground sm:text-lg">
          <Link
            href={href}
            aria-label={`${item.title} (${kindLabel}, ${item.year})`}
            className="rounded outline-none transition-colors hover:text-accent focus-visible:ring-2 focus-visible:ring-accent"
          >
            {item.title}
          </Link>
        </h3>

        <RatingDisplay value={item.averageRating} />

        {note && (
          <p className="mt-0.5 text-sm italic text-foreground/60">
            &ldquo;{note}&rdquo;
          </p>
        )}
      </div>
    </article>
  );
}
