import { Container } from "@/components/ui/container";
import { FeedSkeleton } from "@/components/skeletons/activity-skeleton";

/**
 * Loading state for `/feed`. The feed is always rendered per-request (it is
 * viewer-specific), so this placeholder is what a reader sees while the first
 * page is read from the database.
 */
export default function FeedLoading() {
  return (
    <Container className="py-10 md:py-14">
      <header className="max-w-2xl">
        <h1 className="font-display text-4xl leading-tight tracking-tight text-foreground sm:text-5xl">
          Feed
        </h1>
        <p className="mt-3 text-base text-foreground/70">
          What the people you follow have watched, read, and reviewed &mdash;
          newest first.
        </p>
      </header>

      <div className="mt-10">
        <FeedSkeleton count={4} />
      </div>
    </Container>
  );
}
