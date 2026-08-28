import Link from "next/link";
import type { MediaItem } from "@/lib/types";
import { MediaPoster } from "@/components/media/media-poster";
import {
  MediaTypeBadge,
  mediaKindLabel,
} from "@/components/media/media-type-badge";
import { RatingDisplay } from "@/components/ui/rating-display";
import { cn } from "@/lib/cn";

interface MediaCardProps {
  item: MediaItem;
  /** `poster` is a vertical rail card; `wide` is a horizontal row card. */
  variant?: "poster" | "wide";
  className?: string;
  priority?: boolean;
  /**
   * Optional selection callback fired on the card's link activation (click or
   * keyboard). Used by client surfaces (e.g. Explore search) for best-effort
   * aggregate analytics; navigation proceeds regardless. Only provide this from
   * within a Client Component.
   */
  onSelect?: () => void;
}

/**
 * Links a `MediaItem` to its future detail page at `/title/[slug]`.
 * The whole card is a single anchor so the entire artwork is a large,
 * comfortable click/tap target with a visible focus ring.
 *
 * Route derivation intentionally uses `item.slug`, never `item.title`, so
 * URLs remain stable even if a display title is later edited.
 */
export function MediaCard({
  item,
  variant = "poster",
  className,
  priority = false,
  onSelect,
}: MediaCardProps) {
  const href = `/title/${item.slug}`;

  if (variant === "wide") {
    return (
      <article
        className={cn(
          "rounded-xl border border-border/60 bg-surface-1 transition-colors hover:border-border",
          className,
        )}
      >
        <Link
          href={href}
          onClick={onSelect}
          className="flex gap-5 rounded-xl p-4 outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <MediaPoster
            item={item}
            sizes="96px"
            decorative
            className="w-24 shrink-0"
          />
          <div className="flex min-w-0 flex-col gap-2">
            <div className="flex items-center gap-2">
              <MediaTypeBadge kind={item.kind} />
              <span className="text-xs text-foreground/50 tabular-nums">
                {item.year}
              </span>
            </div>
            <h3 className="truncate font-display text-lg leading-tight text-foreground">
              {item.title}
            </h3>
            <p className="line-clamp-2 text-sm text-foreground/60">
              {item.synopsis}
            </p>
            <RatingDisplay value={item.averageRating} />
          </div>
        </Link>
      </article>
    );
  }

  return (
    <article className={cn("group", className)}>
      <Link
        href={href}
        onClick={onSelect}
        className="flex flex-col gap-3 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-accent"
        aria-label={`${item.title} (${mediaKindLabel(item.kind)}, ${item.year})`}
      >
        <div className="overflow-hidden rounded-lg transition duration-300 group-hover:ring-accent/40">
          <MediaPoster
            item={item}
            decorative
            priority={priority}
            className="transition-transform duration-500 group-hover:scale-[1.03]"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-wide text-foreground/50">
            <span>{mediaKindLabel(item.kind)}</span>
            <span aria-hidden="true">·</span>
            <span className="tabular-nums">{item.year}</span>
          </div>
          <h3 className="font-display text-base leading-snug text-foreground">
            {item.title}
          </h3>
          <RatingDisplay value={item.averageRating} />
        </div>
      </Link>
    </article>
  );
}
