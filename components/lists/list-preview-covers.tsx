import { MediaPoster } from "@/components/media/media-poster";
import type { ListPreviewCover } from "@/components/lists/list-view";
import { cn } from "@/lib/cn";

interface ListPreviewCoversProps {
  covers: ListPreviewCover[];
  /** Maximum number of covers to fan out. Defaults to 5. */
  max?: number;
  className?: string;
}

/**
 * Editorial, overlapping fan of a list's cover artwork.
 *
 * This is purely decorative: the whole group is `aria-hidden` and every poster
 * uses an empty alt, because the list's title, creator, and item count are
 * already announced by the surrounding card/link. That keeps screen readers
 * from reading a redundant pile of cover names.
 *
 * The covers overlap with a negative inline start margin and a rising
 * z-index so the first title sits on top. Widths are percentage-based and the
 * container clips overflow, so the fan never pushes past its column on mobile.
 */
export function ListPreviewCovers({
  covers,
  max = 5,
  className,
}: ListPreviewCoversProps) {
  const shown = covers.slice(0, max);
  if (shown.length === 0) {
    return (
      <div
        aria-hidden="true"
        className={cn(
          "flex aspect-[16/9] w-full items-center justify-center rounded-lg bg-surface-2 ring-1 ring-inset ring-border/60",
          className,
        )}
      />
    );
  }

  return (
    <div
      aria-hidden="true"
      className={cn("flex w-full items-end overflow-hidden", className)}
    >
      {shown.map((cover, index) => (
        <div
          key={cover.id}
          className={cn(
            "relative w-[30%] shrink-0 rounded-md shadow-lg shadow-black/30",
            index === 0 ? "z-[5]" : "-ml-[15%]",
            index === 1 && "z-[4]",
            index === 2 && "z-[3]",
            index === 3 && "z-[2]",
            index >= 4 && "z-[1]",
          )}
        >
          <MediaPoster
            item={{ title: cover.title, posterUrl: cover.posterUrl }}
            sizes="(min-width: 1024px) 12vw, 30vw"
            decorative
            className="rounded-md"
          />
        </div>
      ))}
    </div>
  );
}
