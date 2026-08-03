import Link from "next/link";
import { MessageSquare } from "lucide-react";
import { MediaPoster } from "@/components/media/media-poster";
import {
  MediaTypeBadge,
  mediaKindLabel,
} from "@/components/media/media-type-badge";
import { StarRating } from "@/components/ui/star-rating";
import type { DiaryEntryView } from "@/components/diary/diary-view";
import { diaryActionLabel } from "@/components/diary/diary-view";
import { cn } from "@/lib/cn";

interface DiaryEntryProps {
  entry: DiaryEntryView;
  className?: string;
}

/** Day-of-month, e.g. "2", shown in the left date rail. */
const dayFormatter = new Intl.DateTimeFormat("en", { day: "numeric" });
/** Weekday abbreviation, e.g. "Sun", shown under the day. */
const weekdayFormatter = new Intl.DateTimeFormat("en", { weekday: "short" });
/** Full, human date used for the accessible label and `<time>` title. */
const fullDateFormatter = new Intl.DateTimeFormat("en", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

/**
 * A single diary row: a compact date rail, cover artwork, and the title with
 * its media type, the action taken, an optional rating, and — if one exists —
 * a small review indicator. Deliberately a log row, not a full review card:
 * the review body is never reproduced here beyond a one-line excerpt.
 *
 * Both the artwork and the title link to the unified `/title/[slug]` page.
 */
export function DiaryEntry({ entry, className }: DiaryEntryProps) {
  const date = new Date(entry.loggedAt);
  const action = diaryActionLabel(entry.action);
  const kindLabel = mediaKindLabel(entry.kind);

  return (
    <article className={cn("flex gap-4 sm:gap-5", className)}>
      <time
        dateTime={entry.loggedAt}
        title={fullDateFormatter.format(date)}
        className="flex w-9 shrink-0 flex-col items-center pt-1 text-center leading-none"
      >
        <span className="font-display text-xl text-foreground tabular-nums">
          {dayFormatter.format(date)}
        </span>
        <span className="mt-1 text-[11px] uppercase tracking-wide text-foreground/40">
          {weekdayFormatter.format(date)}
        </span>
      </time>

      <Link
        href={`/title/${entry.slug}`}
        aria-label={`View ${entry.title}`}
        tabIndex={-1}
        className="shrink-0 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <MediaPoster
          item={{ title: entry.title, posterUrl: entry.posterUrl }}
          sizes="64px"
          decorative
          className="w-12 rounded-md sm:w-16"
        />
      </Link>

      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-foreground/50">
          <MediaTypeBadge kind={entry.kind} />
          <span className="tabular-nums">{entry.year}</span>
        </div>

        <h3 className="font-display text-base leading-snug text-foreground sm:text-lg">
          <Link
            href={`/title/${entry.slug}`}
            aria-label={`${entry.title} (${kindLabel}, ${entry.year})`}
            className="rounded outline-none transition-colors hover:text-accent focus-visible:ring-2 focus-visible:ring-accent"
          >
            {entry.title}
          </Link>
        </h3>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="text-sm text-foreground/60">{action}</span>
          {entry.rating != null && (
            <StarRating value={entry.rating} showNumeric />
          )}
        </div>

        {entry.review && (
          <p className="mt-0.5 flex items-start gap-1.5 text-sm text-foreground/60">
            <MessageSquare
              className="mt-0.5 size-3.5 shrink-0 text-accent"
              aria-hidden="true"
            />
            <span className="min-w-0">
              <span className="sr-only">Reviewed: </span>
              <span className="italic line-clamp-1">
                {entry.review.title ?? entry.review.excerpt}
              </span>
            </span>
          </p>
        )}
      </div>
    </article>
  );
}
