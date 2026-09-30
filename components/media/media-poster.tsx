import type { MediaItem } from "@/lib/types";
import { cn } from "@/lib/cn";
import { displayableArtwork } from "@/lib/media/artwork";
import { ArtworkImage } from "./artwork-image";

/**
 * The compact typographic stand-in used when a title has no real provider
 * artwork (missing, a demo placeholder, or an image that failed to load).
 */
export function ArtworkFallback({
  title,
  decorative = false,
  size = "sm",
}: {
  title: string;
  decorative?: boolean;
  size?: "sm" | "lg";
}) {
  return (
    <div
      role={decorative ? undefined : "img"}
      aria-label={decorative ? undefined : `${title} (no artwork)`}
      aria-hidden={decorative ? true : undefined}
      className="absolute inset-0 flex items-end bg-surface-2 p-3"
    >
      <span
        className={cn(
          "line-clamp-4 text-balance font-display leading-snug text-foreground/60",
          size === "lg" ? "text-lg" : "text-sm",
        )}
      >
        {title}
      </span>
    </div>
  );
}

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
  const artwork = displayableArtwork(item.posterUrl);
  const fallback = (
    <ArtworkFallback title={item.title} decorative={decorative} />
  );
  return (
    <div
      className={cn(
        "relative w-full overflow-hidden rounded-lg bg-surface-2 ring-1 ring-inset ring-border/60",
        artwork ? RATIO_CLASS[ratio] : RATIO_CLASS["16/9"],
        className,
      )}
    >
      {artwork ? (
        <ArtworkImage
          src={artwork}
          alt={decorative ? "" : `${item.title} cover`}
          sizes={sizes}
          priority={priority}
          className="object-cover"
          fallback={fallback}
        />
      ) : (
        fallback
      )}
    </div>
  );
}
