import type { Metadata } from "next";
import { Container } from "@/components/ui/container";
import { FeedList } from "@/components/feed/feed-list";
import {
  FeedErrorState,
  FeedNoActivityState,
  FeedNoFollowsState,
  FeedSignedOutState,
  FeedUnavailableState,
} from "@/components/feed/feed-states";
import { getCurrentUser } from "@/lib/auth/data";
import { getFollowingFeedPage } from "@/lib/supabase/feed";
import { getMyFollowingCount } from "@/lib/supabase/follows";
import { setLikeAction } from "@/components/likes/like-actions";
import { loadMoreFeedAction } from "./actions";

export const metadata: Metadata = {
  title: "Feed",
  description:
    "What the people you follow have watched, read, and reviewed, newest first.",
};

/**
 * `/feed` — the real following feed.
 *
 * Page one is rendered on the server from the authoritative records; further
 * pages are appended by the client list through `loadMoreFeedAction`. Every
 * distinct state is told truthfully and separately: signed out, following
 * nobody, following-but-no-activity, a failed read (with retry), and a
 * Supabase-unconfigured environment. Mock activity is never substituted.
 *
 * The read is viewer-specific and therefore per-request only — the reader uses
 * the SSR client with no shared cache, and the auth DAL reads cookies, so this
 * route is always rendered dynamically.
 */
export default async function FeedPage() {
  const page = await getFollowingFeedPage();

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
        <FeedBody page={page} />
      </div>
    </Container>
  );
}

async function FeedBody({
  page,
}: {
  page: Awaited<ReturnType<typeof getFollowingFeedPage>>;
}) {
  if (page.status === "unavailable") return <FeedUnavailableState />;
  if (page.status === "signed-out")
    return <FeedSignedOutState returnTo="/feed" />;
  if (page.status === "error") return <FeedErrorState />;

  if (page.items.length === 0) {
    // An empty page has two very different causes; read the real relationship
    // count rather than guessing which message to show.
    const followingCount = await getMyFollowingCount();
    return followingCount === 0 ? (
      <FeedNoFollowsState />
    ) : (
      <FeedNoActivityState />
    );
  }

  // Keyed by viewer identity so switching accounts remounts the list with
  // empty accumulated state instead of reusing the previous viewer's pages.
  const viewer = await getCurrentUser();

  // The feed is a followers-only surface, so every viewer here is signed in;
  // the like control still passes the auth flags explicitly for consistency.
  return (
    <FeedList
      key={viewer?.id ?? "anonymous"}
      initialItems={page.items}
      initialCursor={page.nextCursor}
      initialHasMore={page.hasMore}
      loadMore={loadMoreFeedAction}
      like={{
        isAuthenticated: viewer !== null,
        signInHref: "/sign-in?returnTo=%2Ffeed",
        returnTo: "/feed",
        action: setLikeAction,
      }}
    />
  );
}
