import { Star, StarHalf } from "lucide-react";
import type { RatingValue } from "@/lib/types";
import { cn } from "@/lib/cn";

interface StarRatingProps {
  value: RatingValue | number;
  /** Compact label like "4.5" shown next to the icons. */
  showNumeric?: boolean;
  className?: string;
}

/**
 * Non-interactive 5-star rating display in half-star increments.
 * Interactive rating input is intentionally out of scope for the MVP foundation.
 */
export function StarRating({
  value,
  showNumeric = false,
  className,
}: StarRatingProps) {
  const clamped = Math.max(0, Math.min(5, value));
  const full = Math.floor(clamped);
  const hasHalf = clamped - full >= 0.5;
  const empty = 5 - full - (hasHalf ? 1 : 0);

  return (
    <span
      className={cn("inline-flex items-center gap-1 text-accent", className)}
      aria-label={`${clamped} out of 5 stars`}
    >
      <span className="inline-flex items-center" aria-hidden="true">
        {Array.from({ length: full }).map((_, i) => (
          <Star
            key={`f-${i}`}
            className="size-3.5 fill-current"
            strokeWidth={0}
          />
        ))}
        {hasHalf && (
          <StarHalf className="size-3.5 fill-current" strokeWidth={0} />
        )}
        {Array.from({ length: empty }).map((_, i) => (
          <Star
            key={`e-${i}`}
            className="size-3.5 text-foreground/20"
            strokeWidth={1.5}
          />
        ))}
      </span>
      {showNumeric && (
        <span className="text-xs font-medium tabular-nums text-foreground/70">
          {clamped.toFixed(1)}
        </span>
      )}
    </span>
  );
}
