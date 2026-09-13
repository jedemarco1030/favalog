import Link from "next/link";
import { Compass, ListChecks, TriangleAlert, Users } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";

/**
 * The distinct, truthful states of the following feed.
 *
 * Each one says exactly what is true — "you follow nobody" is not the same
 * message as "the people you follow haven't logged anything", and a read
 * failure is never papered over with example activity.
 */

const ACCENT_LINK =
  "inline-flex items-center gap-2 rounded-full border border-accent/40 bg-accent/10 px-4 py-2 text-sm font-medium text-accent outline-none transition-colors hover:bg-accent/15 focus-visible:ring-2 focus-visible:ring-accent";

const NEUTRAL_LINK =
  "inline-flex items-center gap-2 rounded-full border border-border/70 bg-surface-1 px-4 py-2 text-sm font-medium text-foreground outline-none transition-colors hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-accent";

/** Signed out: an invitation, through the safe `returnTo` sign-in flow. */
export function FeedSignedOutState({ returnTo }: { returnTo: string }) {
  return (
    <EmptyState
      icon={Users}
      title="Sign in to follow people."
      description="Your feed shows what the accounts you follow have watched, read, and reviewed."
      action={
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link
            href={`/auth/sign-in?returnTo=${encodeURIComponent(returnTo)}`}
            className={ACCENT_LINK}
          >
            Sign in
          </Link>
          <Link href="/lists" className={NEUTRAL_LINK}>
            <ListChecks className="size-4" aria-hidden="true" />
            Browse community lists
          </Link>
        </div>
      }
    />
  );
}

/** Following nobody: explain the feed and point at where people are found. */
export function FeedNoFollowsState() {
  return (
    <EmptyState
      icon={Users}
      title="You're not following anyone yet."
      description="Once you follow someone, everything they watch, read, and review shows up here, newest first."
      action={
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link href="/lists" className={ACCENT_LINK}>
            <ListChecks className="size-4" aria-hidden="true" />
            Find people through community lists
          </Link>
          <Link href="/explore" className={NEUTRAL_LINK}>
            <Compass className="size-4" aria-hidden="true" />
            Explore titles
          </Link>
        </div>
      }
    />
  );
}

/** Following people, but none of them has any eligible activity yet. */
export function FeedNoActivityState() {
  return (
    <EmptyState
      icon={Users}
      title="Nothing from your circle yet."
      description="The people you follow haven't logged or reviewed anything yet. Their activity will appear here as soon as they do."
      action={
        <Link href="/lists" className={NEUTRAL_LINK}>
          <ListChecks className="size-4" aria-hidden="true" />
          Find more people to follow
        </Link>
      }
    />
  );
}

/** A configured read failed — retry, never a mock-activity substitution. */
export function FeedErrorState({
  retryHref = "/feed",
}: { retryHref?: string } = {}) {
  return (
    <EmptyState
      icon={TriangleAlert}
      title="We couldn't load your feed."
      description="Something went wrong reaching your Favalog. Please try again in a moment."
      action={
        <Link href={retryHref} className={NEUTRAL_LINK}>
          Try again
        </Link>
      }
    />
  );
}

/** No Supabase configuration: clearly labelled as unavailable, not empty. */
export function FeedUnavailableState() {
  return (
    <EmptyState
      icon={Users}
      title="The feed isn't available in this environment."
      description="Following activity comes from a live Favalog account, so there is nothing real to show here. No example activity is invented in its place."
      action={
        <Link href="/explore" className={NEUTRAL_LINK}>
          <Compass className="size-4" aria-hidden="true" />
          Explore titles
        </Link>
      }
    />
  );
}
