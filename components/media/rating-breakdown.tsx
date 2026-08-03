import type { RatingDistribution } from "@/lib/types";
import { StarRating } from "@/components/ui/star-rating";
import { cn } from "@/lib/cn";

interface RatingBreakdownProps {
  distribution: RatingDistribution;
  className?: string;
}

const countFormatter = new Intl.NumberFormat("en");
const percentFormatter = new Intl.NumberFormat("en", {
  style: "percent",
  maximumFractionDigits: 0,
});

/**
 * Community rating summary: average, total count, and a semantic histogram
 * with one row per whole-star bucket. The bar width is decorative — screen
 * readers get percentages and counts via visible text, not bar width alone.
 */
export function RatingBreakdown({ distribution, className }: RatingBreakdownProps) {
  const { average, count, buckets } = distribution;
  const max = Math.max(1, ...buckets);

  return (
    <div
      className={cn(
        "rounded-xl border border-border/60 bg-surface-1 p-5",
        className,
      )}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <p className="font-display text-4xl leading-none text-foreground tabular-nums">
            {average.toFixed(1)}
          </p>
          <div className="mt-2">
            <StarRating value={average} />
          </div>
        </div>
        <p className="text-sm text-foreground/60 tabular-nums">
          {countFormatter.format(count)}{" "}
          {count === 1 ? "rating" : "ratings"}
        </p>
      </div>

      <ol className="mt-5 space-y-2" aria-label="Rating distribution">
        {[5, 4, 3, 2, 1].map((star) => {
          const bucketCount = buckets[star - 1];
          const percent = count > 0 ? bucketCount / count : 0;
          return (
            <li
              key={star}
              className="grid grid-cols-[3.25rem_minmax(0,1fr)_5rem] items-center gap-3 text-xs"
            >
              <span className="text-foreground/70 tabular-nums">
                <span aria-hidden="true">{star}★</span>
                <span className="sr-only">{star} stars</span>
              </span>
              <span
                className="h-2 overflow-hidden rounded-full bg-surface-2"
                aria-hidden="true"
              >
                <span
                  className="block h-full rounded-full bg-accent/70"
                  style={{ width: `${(bucketCount / max) * 100}%` }}
                />
              </span>
              <span className="text-right text-foreground/60 tabular-nums">
                {countFormatter.format(bucketCount)}
                <span className="ml-2 text-foreground/40">
                  {percentFormatter.format(percent)}
                </span>
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
