import type { MediaItem } from "@/lib/types";
import { cn } from "@/lib/cn";

interface MediaDetailsProps {
  item: MediaItem;
  className?: string;
}

interface DetailRow {
  label: string;
  value: string;
}

function detailsFor(item: MediaItem): DetailRow[] {
  const rows: DetailRow[] = [];
  switch (item.kind) {
    case "movie":
      rows.push({ label: "Director", value: item.director });
      rows.push({ label: "Runtime", value: formatRuntime(item.runtimeMinutes) });
      rows.push({ label: "Release year", value: String(item.year) });
      if (item.genres.length) {
        rows.push({ label: "Genres", value: item.genres.join(", ") });
      }
      if (item.cast.length) {
        rows.push({ label: "Cast", value: item.cast.join(", ") });
      }
      break;
    case "tv":
      if (item.creators.length) {
        rows.push({
          label: item.creators.length > 1 ? "Creators" : "Creator",
          value: item.creators.join(", "),
        });
      }
      rows.push({
        label: "Seasons",
        value: `${item.seasons} · ${item.episodes} episodes`,
      });
      rows.push({
        label: "Run",
        value: `${item.year} · ${statusLabel(item.status)}`,
      });
      if (item.genres.length) {
        rows.push({ label: "Genres", value: item.genres.join(", ") });
      }
      break;
    case "book":
      rows.push({
        label: item.authors.length > 1 ? "Authors" : "Author",
        value: item.authors.join(", "),
      });
      rows.push({ label: "Pages", value: `${item.pageCount}` });
      rows.push({ label: "Published", value: String(item.year) });
      if (item.publisher) {
        rows.push({ label: "Publisher", value: item.publisher });
      }
      if (item.genres.length) {
        rows.push({ label: "Genres", value: item.genres.join(", ") });
      }
      break;
  }
  return rows;
}

function formatRuntime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function statusLabel(status: "ongoing" | "ended" | "upcoming"): string {
  switch (status) {
    case "ongoing":
      return "Ongoing";
    case "ended":
      return "Ended";
    case "upcoming":
      return "Upcoming";
  }
}

/**
 * Adaptive details block for a `MediaItem`. Uses discriminated-union narrowing
 * so each media kind only shows the fields that logically belong to it —
 * `MediaItemBase` intentionally does not carry `director`, `authors`, etc.
 */
export function MediaDetails({ item, className }: MediaDetailsProps) {
  const rows = detailsFor(item);
  return (
    <dl
      className={cn(
        "grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-[minmax(0,7rem)_minmax(0,1fr)]",
        className,
      )}
    >
      {rows.map((row) => (
        <div
          key={row.label}
          className="sm:contents"
        >
          <dt className="text-[11px] font-medium uppercase tracking-wide text-foreground/50">
            {row.label}
          </dt>
          <dd className="text-sm text-foreground/85">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}
