import type { Metadata } from "next";
import { Container } from "@/components/ui/container";
import { ListSection } from "@/components/lists/list-section";
import { ListsBrowser } from "@/components/lists/lists-browser";
import { RealListsSections } from "@/components/lists/real-lists-sections";
import { CreateListLauncher } from "@/components/lists/create-list-launcher";
import { toListCardView } from "@/components/lists/to-list-card-view";
import type { ListCardView } from "@/components/lists/list-view";
import {
  getFeaturedLists,
  getLists,
  getListsFromCircle,
  getPopularLists,
  getRecentlyUpdatedLists,
  listSearchTermsFor,
} from "@/lib/data";
import type { List } from "@/lib/types";
import { isAuthAvailable } from "@/lib/auth/capability";
import { getCurrentUser } from "@/lib/auth/data";
import {
  getMyLists,
  getPublicLists,
  type MyListsResult,
} from "@/lib/supabase/lists";

export const metadata: Metadata = {
  title: "Lists",
  description:
    "Browse cross-media collections of movies, TV, and books, made by people who love what you love.",
};

const SECTION_LIMIT = 6;

/**
 * `/lists` — the discovery/index surface for cross-media collections.
 *
 * Server-first: real (persistent) sections come first — the signed-in viewer's
 * own lists and the community's public lists, from serializable view models —
 * followed by the curated, clearly-labelled mock demonstration collections
 * (Popular / From your circle / Recently updated / Staff picks). The mock
 * sections and their lightweight client-side search (`ListsBrowser`) are kept
 * separate from the real sections so nothing misrepresents mock content as live
 * community activity. A signed-in viewer can create a list from the header; a
 * signed-out visitor is routed to sign-in; a no-env build shows a controlled
 * unavailable state and preserves public mock browsing.
 */
export default async function ListsPage() {
  const authAvailable = isAuthAvailable();
  const viewer = authAvailable ? await getCurrentUser() : null;

  // Real reads (owner/visibility-scoped by RLS; never raw rows). "Your lists"
  // is only read for a signed-in viewer; community lists are always attempted.
  const myLists: MyListsResult | null = viewer ? await getMyLists() : null;
  const community = await getPublicLists();

  const createReturnTo = "/lists";
  const signInHref = `/auth/sign-in?returnTo=${encodeURIComponent(createReturnTo)}`;
  const launcherVariant = !authAvailable
    ? "unavailable"
    : viewer
      ? "signed-in"
      : "signed-out";

  // Curated mock content, resolved once into serializable card views.
  const allLists = getLists();
  const views = allLists
    .map(toListCardView)
    .filter((view): view is ListCardView => view !== null);
  const viewsById = new Map(views.map((view) => [view.id, view]));

  const toViews = (lists: List[]): ListCardView[] =>
    lists
      .map((list) => viewsById.get(list.id))
      .filter((view): view is ListCardView => view !== undefined);

  const haystack: Record<string, string> = {};
  for (const list of allLists) {
    haystack[list.id] = listSearchTermsFor(list).join(" ").toLowerCase();
  }

  const sections: Array<{
    key: string;
    title: string;
    description: string;
    lists: ListCardView[];
  }> = [
    {
      key: "popular",
      title: "Popular lists",
      description: "Curated example collections built around a theme.",
      lists: toViews(getPopularLists(SECTION_LIMIT)),
    },
    {
      key: "circle",
      title: "From your circle",
      description:
        "Example collections showing how followed people's lists would appear.",
      lists: toViews(getListsFromCircle(SECTION_LIMIT)),
    },
    {
      key: "recent",
      title: "Recently updated",
      description:
        "Example collections demonstrating the recently-updated view.",
      lists: toViews(getRecentlyUpdatedLists(SECTION_LIMIT)),
    },
    {
      key: "featured",
      title: "Staff picks",
      description: "A few editorial example collections from the Favalog team.",
      lists: toViews(getFeaturedLists()),
    },
  ];

  const defaultSections = (
    <div className="flex flex-col gap-16">
      {sections.map((section) => (
        <ListSection
          key={section.key}
          title={section.title}
          description={section.description}
          lists={section.lists}
        />
      ))}
    </div>
  );

  return (
    <Container className="py-10 md:py-14">
      <header className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-2xl">
          <h1 className="font-display text-4xl leading-tight tracking-tight text-foreground sm:text-5xl">
            Lists
          </h1>
          <p className="mt-3 text-base text-foreground/70">
            Collections made by people who love what you love.
          </p>
        </div>
        <CreateListLauncher
          variant={launcherVariant}
          returnTo={createReturnTo}
          signInHref={signInHref}
        />
      </header>

      <RealListsSections
        myLists={myLists}
        community={community}
        createReturnTo={createReturnTo}
        createSignInHref={signInHref}
      />

      <section aria-labelledby="curated-heading" className="mt-16">
        <div className="mb-8 max-w-2xl">
          <h2
            id="curated-heading"
            className="font-display text-2xl tracking-tight text-foreground"
          >
            Curated examples
          </h2>
          <p className="mt-2 text-sm text-foreground/60">
            Editorial demonstration collections. These aren&rsquo;t live
            community activity — likes, owners, and follows shown here are
            illustrative.
          </p>
        </div>

        <ListsBrowser
          lists={views}
          haystack={haystack}
          defaultSections={defaultSections}
        />
      </section>
    </Container>
  );
}
