import { Skeleton } from "@/components/ui/skeleton";
import { MediaRowSkeleton } from "@/components/skeletons/media-skeletons";
import { cn } from "@/lib/cn";

interface ProfileSkeletonProps {
  className?: string;
}

/**
 * Full profile-shaped skeleton: avatar + name + stats + a favorites rail.
 * Sized to match the `/profile/[username]` layout so hydration doesn't
 * shift content around.
 */
export function ProfileSkeleton({ className }: ProfileSkeletonProps) {
  return (
    <div
      role="status"
      aria-label="Loading profile"
      aria-busy="true"
      className={cn("flex flex-col gap-10", className)}
    >
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
        <Skeleton className="size-20 rounded-full" />
        <div className="flex flex-1 flex-col gap-2">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-3 w-72" />
        </div>
      </div>
      <div className="flex flex-wrap gap-x-10 gap-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex flex-col gap-1.5">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-6 w-14" />
          </div>
        ))}
      </div>
      <MediaRowSkeleton />
      <span className="sr-only">Loading profile…</span>
    </div>
  );
}
