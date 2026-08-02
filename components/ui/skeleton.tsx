import { cn } from "@/lib/cn";

interface SkeletonProps {
  className?: string;
  /** Screen-reader label for a wrapping status region, if any. */
  "aria-label"?: string;
}

/**
 * Base building block for loading skeletons. Non-interactive, decorative:
 * meaning is conveyed by the surrounding `role="status"` block, not by
 * individual shapes.
 */
export function Skeleton({ className, ...rest }: SkeletonProps) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "block animate-pulse rounded-md bg-surface-2/80",
        className,
      )}
      {...rest}
    />
  );
}
