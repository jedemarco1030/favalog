import type { Metadata } from "next";
import { Container } from "@/components/ui/container";
import { ListSection } from "@/components/lists/list-section";
import { ListsBrowser } from "@/components/lists/lists-browser";
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

export const metadata: Metadata = {
  title: "Lists",
  description:
    "Browse cross-media collections of movies, TV, and books, made by people who love what you love.",
};

const SECTION_LIMIT = 6;

/**
 * `/lists` — the discovery/index surface for cross-media collections.
 *
 * The page is server-first: every curated section (Popular, From your circle,
 * Recently updated, Staff picks) is resolved into serializable `ListCardView`s
 * on the server. Only the search field and its results grid hydrate as a
 * Client Component (`ListsBrowser`), which filters the views it is handed and
 * never touches the data layer.
 */
export default function ListsPage() {
  const allLists = getLists();

  // Resolve every list once; reuse the views across sections and search.
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
      description: "The collections resonating across Favalog right now.",
      lists: toViews(getPopularLists(SECTION_LIMIT)),
    },
    {
      key: "circle",
      title: "From your circle",
      description: "New collections from the people you follow.",
      lists: toViews(getListsFromCircle(SECTION_LIMIT)),
    },
    {
      key: "recent",
      title: "Recently updated",
      description: "Lists that gained a title or a rethink lately.",
      lists: toViews(getRecentlyUpdatedLists(SECTION_LIMIT)),
    },
    {
      key: "featured",
      title: "Staff picks",
      description: "A few collections the Favalog team keeps coming back to.",
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
      <header className="mb-8 max-w-2xl md:mb-10">
        <h1 className="font-display text-4xl leading-tight tracking-tight text-foreground sm:text-5xl">
          Lists
        </h1>
        <p className="mt-3 text-base text-foreground/70">
          Collections made by people who love what you love.
        </p>
      </header>

      <ListsBrowser
        lists={views}
        haystack={haystack}
        defaultSections={defaultSections}
      />
    </Container>
  );
}
