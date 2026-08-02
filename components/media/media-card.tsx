import Image from "next/image";
import type { MediaItem } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { StarRating } from "@/components/ui/star-rating";
import { cn } from "@/lib/cn";

interface MediaCardProps {
  item: MediaItem;
  /** Card variant. `poster` is a compact vertical card, `wide` is a hero row. */
  variant?: "poster" | "wide";
  className?: string;
  priority?: boolean;
}

const KIND_LABEL: Record<MediaItem["kind"], string> = {
  movie: "Film",
  tv: "Series",
  book: "Book",
};

/**
 * Displays a MediaItem as a poster card with hover elevation and a rating chip.
 * This component is deliberately a Server Component — no interactivity yet.
 */
export function MediaCard({
  item,
  variant = "poster",
  className,
  priority = false,
}: MediaCardProps) {
  if (variant === "wide") {
    return (
      <article
        className={cn(
          "group flex gap-5 rounded-xl border border-border/60 bg-surface-1 p-4 transition-colors hover:border-border",
          className,
        )}
      >
        <div className="relative aspect-[2/3] w-24 shrink-0 overflow-hidden rounded-md bg-surface-2">
          <Image
            src={item.posterUrl}
            alt=""
            fill
            sizes="96px"
            className="object-cover"
          />
        </div>
        <div className="flex min-w-0 flex-col gap-2">
          <div className="flex items-center gap-2">
            <Badge>{KIND_LABEL[item.kind]}</Badge>
            <span className="text-xs text-foreground/50 tabular-nums">
              {item.year}
            </span>
          </div>
          <h3 className="truncate font-display text-lg leading-tight text-foreground">
            {item.title}
          </h3>
          <p className="line-clamp-2 text-sm text-foreground/60">{item.synopsis}</p>
          {item.averageRating != null && (
            <StarRating value={item.averageRating} showNumeric />
          )}
        </div>
      </article>
    );
  }

  return (
    <article
      className={cn(
        "group flex flex-col gap-3",
        className,
      )}
    >
      <div className="relative aspect-[2/3] w-full overflow-hidden rounded-lg bg-surface-2 ring-1 ring-inset ring-border/60 transition duration-300 group-hover:ring-accent/40">
        <Image
          src={item.posterUrl}
          alt={`${item.title} cover`}
          fill
          sizes="(min-width: 1024px) 20vw, (min-width: 640px) 33vw, 50vw"
          className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          priority={priority}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-wide text-foreground/50">
          <span>{KIND_LABEL[item.kind]}</span>
          <span aria-hidden="true">·</span>
          <span className="tabular-nums">{item.year}</span>
        </div>
        <h3 className="font-display text-base leading-snug text-foreground">
          {item.title}
        </h3>
        {item.averageRating != null && (
          <StarRating value={item.averageRating} showNumeric />
        )}
      </div>
    </article>
  );
}
