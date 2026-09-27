import { ArtworkImage } from "@/components/media/artwork-image";
import { ArtworkFallback } from "@/components/media/media-poster";
import { mediaKindLabel } from "@/components/media/media-type-badge";
import { displayableArtwork } from "@/lib/media/artwork";
import type { DiscoveryCandidate } from "@/lib/discovery/types";
import { formatReleaseDate } from "@/lib/discovery/windows";
import { cn } from "@/lib/cn";
import {
  DiscoveryCardActions,
  type DiscoveryOpenAction,
  type DiscoverySaveAction,
  type SaveListOption,
} from "./discovery-card-actions";

export interface DiscoveryCardContext {
  lists: SaveListOption[] | null;
  returnTo: string;
  openAction: DiscoveryOpenAction;
  saveAction: DiscoverySaveAction;
}

interface DiscoveryCardProps extends DiscoveryCardContext {
  candidate: DiscoveryCandidate;
  /** Show the full release date (date-based shelves) instead of the year. */
  showDate?: boolean;
  /** Show the media type (mixed shelves). */
  showKind?: boolean;
  priority?: boolean;
}

/**
 * A provider title that is not (necessarily) in Favalog yet. Artwork keeps its
 * native shape: posters and covers are portrait, game key art is landscape.
 * Missing artwork falls back to the title set in type, never a stock image.
 */
export function DiscoveryCard({
  candidate,
  showDate,
  showKind,
  priority,
  ...context
}: DiscoveryCardProps) {
  const landscape = candidate.kind === "game";
  const artwork = displayableArtwork(candidate.posterUrl);
  const fallback = (
    <ArtworkFallback title={candidate.title} decorative size="lg" />
  );
  const meta = [
    showKind ? mediaKindLabel(candidate.kind) : null,
    showDate && candidate.releaseDate
      ? formatReleaseDate(candidate.releaseDate)
      : candidate.year
        ? String(candidate.year)
        : null,
  ].filter(Boolean);

  return (
    <article className="flex flex-col gap-3">
      <div
        className={cn(
          "relative overflow-hidden rounded-xl border border-border/50 bg-surface-1",
          landscape ? "aspect-video" : "aspect-[2/3]",
        )}
      >
        {artwork ? (
          <ArtworkImage
            src={artwork}
            alt=""
            priority={priority}
            sizes={
              landscape
                ? "(min-width: 1024px) 30vw, (min-width: 640px) 45vw, 80vw"
                : "(min-width: 1024px) 18vw, (min-width: 640px) 30vw, 45vw"
            }
            className="object-cover"
            fallback={fallback}
          />
        ) : (
          fallback
        )}
      </div>
      <div className="flex flex-col gap-1">
        <h3 className="line-clamp-2 text-pretty text-sm font-medium leading-snug text-foreground">
          {candidate.title}
        </h3>
        {meta.length > 0 && (
          <p className="text-xs text-foreground/55">{meta.join(" · ")}</p>
        )}
      </div>
      <DiscoveryCardActions
        identity={candidate.ref}
        title={candidate.title}
        {...context}
      />
    </article>
  );
}
