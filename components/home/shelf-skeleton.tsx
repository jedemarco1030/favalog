interface ShelfSkeletonProps {
  label: string;
  count?: number;
  artwork?: "poster" | "landscape";
}

/** Dimension-reserving placeholder so streamed shelves never shift layout. */
export function ShelfSkeleton({
  label,
  count = 5,
  artwork = "poster",
}: ShelfSkeletonProps) {
  return (
    <div role="status" aria-label={`Loading ${label}`}>
      <div className="mb-6 flex flex-col gap-2">
        <div className="h-7 w-48 rounded bg-surface-2" />
        <div className="h-4 w-72 max-w-full rounded bg-surface-2/70" />
      </div>
      <div
        className={
          artwork === "landscape"
            ? "grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3"
            : "grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 lg:grid-cols-5"
        }
      >
        {Array.from({ length: count }, (_, i) => (
          <div key={i} className="flex flex-col gap-3">
            <div
              className={`${artwork === "landscape" ? "aspect-[16/9]" : "aspect-[2/3]"} w-full rounded-lg bg-surface-2 motion-safe:animate-pulse`}
            />
            <div className="h-3 w-20 rounded bg-surface-2/70" />
            <div className="h-4 w-32 max-w-full rounded bg-surface-2" />
          </div>
        ))}
      </div>
    </div>
  );
}
