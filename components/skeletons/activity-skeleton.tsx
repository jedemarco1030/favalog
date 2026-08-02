import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/cn";

interface ActivitySkeletonProps {
  className?: string;
}

/** Placeholder matching `ActivityCard`'s poster + text layout. */
export function ActivityCardSkeleton({ className }: ActivitySkeletonProps) {
  return (
    <div
      className={cn(
        "flex gap-4 rounded-xl border border-border/60 bg-surface-1/60 p-4",
        className,
      )}
    >
      <Skeleton className="size-16 shrink-0 rounded-md sm:size-20" />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <Skeleton className="h-3 w-2/3" />
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-3 w-1/2" />
      </div>
    </div>
  );
}

interface FeedSkeletonProps {
  count?: number;
  className?: string;
}

/** Grid of `ActivityCardSkeleton`s for the activity/diary/feed surfaces. */
export function FeedSkeleton({ count = 4, className }: FeedSkeletonProps) {
  return (
    <div
      role="status"
      aria-label="Loading activity"
      aria-busy="true"
      className={cn("grid gap-3 sm:grid-cols-2", className)}
    >
      {Array.from({ length: count }).map((_, i) => (
        <ActivityCardSkeleton key={i} />
      ))}
      <span className="sr-only">Loading activity…</span>
    </div>
  );
}
