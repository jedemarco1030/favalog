import Image from "next/image";
import { mediaKindLabel } from "@/components/media/media-type-badge";
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
        {candidate.posterUrl ? (
          <Image
            src={candidate.posterUrl}
            alt=""
            fill
            priority={priority}
            sizes={
              landscape
                ? "(min-width: 1024px) 30vw, (min-width: 640px) 45vw, 80vw"
                : "(min-width: 1024px) 18vw, (min-width: 640px) 30vw, 45vw"
            }
            className="object-cover"
          />
        ) : (
          <div className="flex h-full items-end p-3">
            <span className="line-clamp-4 text-balance font-display text-lg leading-tight text-foreground/70">
              {candidate.title}
            </span>
          </div>
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
