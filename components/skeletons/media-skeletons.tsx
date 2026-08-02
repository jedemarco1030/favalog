import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/cn";

interface MediaCardSkeletonProps {
  className?: string;
}

/** Poster-shape placeholder that matches the `MediaCard` poster variant. */
export function MediaCardSkeleton({ className }: MediaCardSkeletonProps) {
  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <Skeleton className="aspect-[2/3] w-full rounded-lg" />
      <div className="flex flex-col gap-1.5">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-20" />
      </div>
    </div>
  );
}

interface MediaRowSkeletonProps {
  /** Number of poster placeholders to render. */
  count?: number;
  className?: string;
  showHeader?: boolean;
}

/** Section header + row of `MediaCardSkeleton`s. */
export function MediaRowSkeleton({
  count = 5,
  className,
  showHeader = true,
}: MediaRowSkeletonProps) {
  return (
    <section
      role="status"
      aria-label="Loading media"
      aria-busy="true"
      className={cn(className)}
    >
      {showHeader && (
        <div className="mb-6 flex items-end justify-between gap-4">
          <div className="flex flex-col gap-2">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-3 w-56" />
          </div>
          <Skeleton className="h-4 w-20" />
        </div>
      )}
      <div className="grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 lg:grid-cols-5">
        {Array.from({ length: count }).map((_, i) => (
          <MediaCardSkeleton key={i} />
        ))}
      </div>
      <span className="sr-only">Loading titles…</span>
    </section>
  );
}
