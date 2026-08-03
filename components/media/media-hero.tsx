import Image from "next/image";
import type { MediaItem } from "@/lib/types";
import { MediaPoster } from "@/components/media/media-poster";
import { MediaTypeBadge, mediaKindLabel } from "@/components/media/media-type-badge";
import { StarRating } from "@/components/ui/star-rating";
import { cn } from "@/lib/cn";

interface MediaHeroProps {
  item: MediaItem;
  /** Total number of ratings shown alongside the community average. */
  ratingCount?: number;
  className?: string;
}

const countFormatter = new Intl.NumberFormat("en");

/**
 * Editorial hero for a title detail page. On desktop it uses a two-column
 * arrangement (poster + metadata) sitting on top of an optional backdrop
 * treatment. On mobile the poster is smaller so the metadata reads first
 * and the artwork does not dominate the viewport.
 */
export function MediaHero({ item, ratingCount, className }: MediaHeroProps) {
  const primaryCredit = primaryCreditFor(item);

  return (
    <section className={cn("relative overflow-hidden", className)}>
      {item.backdropUrl && (
        <>
          <div className="pointer-events-none absolute inset-0 -z-10">
            <Image
              src={item.backdropUrl}
              alt=""
              role="presentation"
              fill
              sizes="100vw"
              priority
              className="object-cover opacity-40"
            />
          </div>
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-background/70 via-background/85 to-background"
          />
        </>
      )}

      <div className="grid grid-cols-1 gap-8 py-10 md:grid-cols-[minmax(0,14rem)_minmax(0,1fr)] md:gap-12 md:py-16">
        <div className="mx-auto w-40 sm:w-48 md:mx-0 md:w-56">
          <MediaPoster
            item={item}
            sizes="(min-width: 768px) 224px, 176px"
            priority
            className="w-full shadow-2xl shadow-black/40"
          />
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2 text-xs text-foreground/60">
            <MediaTypeBadge kind={item.kind} />
            <span className="tabular-nums">{item.year}</span>
            {primaryCredit && (
              <>
                <span aria-hidden="true">·</span>
                <span className="truncate">{primaryCredit}</span>
              </>
            )}
          </div>

          <h1 className="font-display text-3xl leading-tight tracking-tight text-foreground sm:text-4xl md:text-5xl">
            {item.title}
            {item.subtitle && (
              <span className="mt-1 block text-lg font-normal text-foreground/60 sm:text-xl">
                {item.subtitle}
              </span>
            )}
          </h1>

          {item.genres.length > 0 && (
            <ul className="flex flex-wrap gap-1.5" aria-label="Genres">
              {item.genres.map((genre) => (
                <li
                  key={genre}
                  className="rounded-full border border-border/60 bg-surface-1 px-2.5 py-0.5 text-[11px] uppercase tracking-wide text-foreground/70"
                >
                  {genre}
                </li>
              ))}
            </ul>
          )}

          {item.averageRating != null && (
            <div className="flex items-center gap-3">
              <StarRating value={item.averageRating} showNumeric />
              {ratingCount != null && (
                <span className="text-xs text-foreground/50 tabular-nums">
                  {countFormatter.format(ratingCount)}{" "}
                  {ratingCount === 1 ? "rating" : "ratings"}
                </span>
              )}
            </div>
          )}

          <p className="max-w-2xl text-base leading-relaxed text-foreground/75 sm:text-lg">
            {item.synopsis}
          </p>

          <p className="sr-only">
            {mediaKindLabel(item.kind)} · released {item.year}
          </p>
        </div>
      </div>
    </section>
  );
}

function primaryCreditFor(item: MediaItem): string | undefined {
  switch (item.kind) {
    case "movie":
      return `Directed by ${item.director}`;
    case "tv":
      return item.creators.length
        ? `Created by ${item.creators.join(", ")}`
        : undefined;
    case "book":
      return item.authors.length ? `By ${item.authors.join(", ")}` : undefined;
  }
}
