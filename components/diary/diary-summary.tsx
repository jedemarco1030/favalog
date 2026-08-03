import type { DiarySummary as DiarySummaryData } from "@/lib/data";
import { cn } from "@/lib/cn";

interface DiarySummaryProps {
  summary: DiarySummaryData;
  className?: string;
}

/**
 * A restrained, single-line rollup of the year's activity. Intentionally not
 * a dashboard: no stat tiles, no charts — just a headline count and a quiet
 * by-kind breakdown, all derived from the diary itself.
 */
export function DiarySummary({ summary, className }: DiarySummaryProps) {
  const parts: Array<{ label: string; value: number }> = [
    { label: "films", value: summary.movies },
    { label: "series", value: summary.tv },
    { label: "books", value: summary.books },
  ];

  return (
    <p
      className={cn(
        "flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm text-foreground/50",
        className,
      )}
    >
      <span className="text-foreground/80">
        <span className="font-medium tabular-nums text-foreground">
          {summary.total}
        </span>{" "}
        logged in <span className="tabular-nums">{summary.year}</span>
      </span>
      <span aria-hidden="true">·</span>
      {parts.map((part, index) => (
        <span key={part.label} className="inline-flex items-baseline gap-2">
          <span>
            <span className="tabular-nums text-foreground/70">
              {part.value}
            </span>{" "}
            {part.label}
          </span>
          {index < parts.length - 1 && <span aria-hidden="true">·</span>}
        </span>
      ))}
    </p>
  );
}
