import { StarRating } from "@/components/ui/star-rating";
import type { RatingValue } from "@/lib/types";
import { cn } from "@/lib/cn";

interface RatingDisplayProps {
  value: RatingValue | number | undefined;
  /** Optional caption, e.g. `"community"` or a review count. */
  caption?: string;
  size?: "sm" | "md";
  className?: string;
}

/**
 * Read-only rating chip that pairs stars with a numeric value and optional
 * caption. Renders nothing if `value` is nullish so callers can pass an
 * optional field directly.
 */
export function RatingDisplay({
  value,
  caption,
  size = "sm",
  className,
}: RatingDisplayProps) {
  if (value == null) return null;
  return (
    <div
      className={cn(
        "inline-flex items-center gap-2",
        size === "md" ? "text-sm" : "text-xs",
        className,
      )}
    >
      <StarRating value={value} showNumeric />
      {caption && <span className="text-foreground/50">{caption}</span>}
    </div>
  );
}
