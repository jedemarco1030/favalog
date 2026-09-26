import Image from "next/image";
import type { MediaItem } from "@/lib/types";
import { cn } from "@/lib/cn";

interface MediaPosterProps {
  item: Pick<MediaItem, "title" | "posterUrl">;
  /** Tailwind sizes attribute for the underlying Next Image. */
  sizes?: string;
  className?: string;
  priority?: boolean;
  /**
   * If `true`, the poster is treated as decorative (empty alt) — use this
   * when a visible title accompanies the poster in the same card/link.
   */
  decorative?: boolean;
  /** Aspect ratio to render. Defaults to 2/3 which suits films, TV, and books. */
  ratio?: "2/3" | "3/4" | "16/9";
}

const RATIO_CLASS: Record<NonNullable<MediaPosterProps["ratio"]>, string> = {
  "2/3": "aspect-[2/3]",
  "3/4": "aspect-[3/4]",
  "16/9": "aspect-[16/9]",
};

/**
 * Framed poster/cover artwork used inside `MediaCard`, hero rails, and
 * detail pages. Kept intentionally dumb so callers control layout, sizing
 * and semantics.
 */
export function MediaPoster({
  item,
  sizes = "(min-width: 1024px) 20vw, (min-width: 640px) 33vw, 50vw",
  className,
  priority = false,
  decorative = false,
  ratio = "2/3",
}: MediaPosterProps) {
  return (
    <div
      className={cn(
        "relative w-full overflow-hidden rounded-lg bg-surface-2 ring-1 ring-inset ring-border/60",
        RATIO_CLASS[ratio],
        className,
      )}
    >
      {item.posterUrl ? (
        <Image
          src={item.posterUrl}
          alt={decorative ? "" : `${item.title} cover`}
          fill
          sizes={sizes}
          priority={priority}
          className="object-cover"
        />
      ) : (
        <div
          role={decorative ? undefined : "img"}
          aria-label={decorative ? undefined : `${item.title} (no artwork)`}
          aria-hidden={decorative ? true : undefined}
          className="absolute inset-0 flex items-end bg-surface-2 p-3"
        >
          <span className="line-clamp-4 text-balance font-display text-sm leading-snug text-foreground/60">
            {item.title}
          </span>
        </div>
      )}
    </div>
  );
}
