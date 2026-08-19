import Image from "next/image";
import { BookOpen, Film, Tv } from "lucide-react";
import type { LucideProps } from "lucide-react";
import type { ComponentType } from "react";
import type { MediaKind } from "@/lib/types";
import { cn } from "@/lib/cn";

interface RealListPosterProps {
  /** Trusted stored poster URL; may be empty for a real catalog row. */
  posterUrl: string;
  title: string;
  kind: MediaKind;
  sizes?: string;
  className?: string;
  /** Empty alt when a visible title accompanies the artwork. */
  decorative?: boolean;
}

const KIND_ICON: Record<MediaKind, ComponentType<LucideProps>> = {
  movie: Film,
  tv: Tv,
  book: BookOpen,
};

/**
 * Cover artwork for a real (persistent) list item.
 *
 * Unlike the mock `MediaPoster`, a real catalog row can have an empty
 * `posterUrl`, and `next/image` rejects an empty `src`. When artwork is
 * missing we render an honest, kind-aware placeholder tile rather than a broken
 * image — no fabricated cover, just a neutral fallback keyed to the media kind.
 */
export function RealListPoster({
  posterUrl,
  title,
  kind,
  sizes = "64px",
  className,
  decorative = false,
}: RealListPosterProps) {
  const hasPoster = posterUrl.trim() !== "";
  const Icon = KIND_ICON[kind];

  return (
    <div
      className={cn(
        "relative aspect-[2/3] w-full overflow-hidden rounded-md bg-surface-2 ring-1 ring-inset ring-border/60",
        className,
      )}
    >
      {hasPoster ? (
        <Image
          src={posterUrl}
          alt={decorative ? "" : `${title} cover`}
          fill
          sizes={sizes}
          className="object-cover"
        />
      ) : (
        <span
          className="flex h-full w-full items-center justify-center text-foreground/30"
          role={decorative ? undefined : "img"}
          aria-label={decorative ? undefined : `${title} (no cover art)`}
        >
          <Icon className="size-6" aria-hidden="true" />
        </span>
      )}
    </div>
  );
}
