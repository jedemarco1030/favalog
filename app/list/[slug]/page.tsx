import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Container } from "@/components/ui/container";
import { ListHeader } from "@/components/lists/list-header";
import { ListItemRow } from "@/components/lists/list-item-row";
import { ListSection } from "@/components/lists/list-section";
import { toListCardView } from "@/components/lists/to-list-card-view";
import type { ListCardView } from "@/components/lists/list-view";
import {
  getListBySlug,
  getListItemNote,
  getListMedia,
  getListsByUser,
  getPopularLists,
  getUserById,
} from "@/lib/data";
import { siteConfig } from "@/lib/site-config";

interface ListPageProps {
  params: Promise<{ slug: string }>;
}

const RELATED_LIMIT = 3;

/**
 * Per-list metadata derived from the list's own data. The root layout applies
 * the `%s · Favalog` title template, and `openGraph.url` uses the stable slug
 * route so shared links stay valid across renames.
 */
export async function generateMetadata({
  params,
}: ListPageProps): Promise<Metadata> {
  const { slug } = await params;
  const list = getListBySlug(slug);
  if (!list) {
    return { title: "List not found" };
  }

  const owner = getUserById(list.ownerId);
  const description =
    list.description ??
    `A cross-media collection${owner ? ` by ${owner.displayName}` : ""} on ${siteConfig.name}.`;
  const ogTitle = `${list.title}${owner ? ` — a list by ${owner.displayName}` : ""}`;

  return {
    title: list.title,
    description,
    openGraph: {
      type: "article",
      title: ogTitle,
      description,
      url: `/list/${list.slug}`,
      siteName: siteConfig.name,
    },
    twitter: {
      card: "summary_large_image",
      title: ogTitle,
      description,
    },
  };
}

/**
 * `/list/[slug]` — an individual, cross-media collection.
 *
 * The URL is keyed on the stable `List.slug` so a title edit never breaks a
 * shared link. Unknown slugs call `notFound()` and render the site-wide
 * `app/not-found.tsx`. Movies, TV, and books share one `ListItemRow` renderer;
 * there is no per-kind branching at the page level.
 */
export default async function ListPage({ params }: ListPageProps) {
  const { slug } = await params;
  const list = getListBySlug(slug);
  if (!list) notFound();

  const owner = getUserById(list.ownerId);
  if (!owner) notFound();

  const media = getListMedia(list);

  // "More lists from this creator", falling back to popular collections when
  // the creator has authored only this one list.
  const creatorLists = getListsByUser(list.ownerId).filter(
    (other) => other.id !== list.id,
  );
  const fallbackLists = getPopularLists()
    .filter((other) => other.id !== list.id)
    .slice(0, RELATED_LIMIT);
  const relatedSource =
    creatorLists.length > 0
      ? creatorLists.slice(0, RELATED_LIMIT)
      : fallbackLists;
  const relatedTitle =
    creatorLists.length > 0
      ? `More lists from ${owner.displayName}`
      : "More collections";
  const related = relatedSource
    .map(toListCardView)
    .filter((view): view is ListCardView => view !== null);

  return (
    <article>
      <Container className="py-10 md:py-14">
        <ListHeader list={list} owner={owner} media={media} />

        <section aria-label="List contents" className="mt-10">
          {media.length > 0 ? (
            <ol className="flex flex-col gap-6">
              {media.map((item, index) => (
                <li key={item.id}>
                  <ListItemRow
                    item={item}
                    rank={list.isRanked ? index + 1 : undefined}
                    note={getListItemNote(list, item.id)}
                  />
                </li>
              ))}
            </ol>
          ) : null}
        </section>

        {related.length > 0 && (
          <ListSection title={relatedTitle} lists={related} className="mt-16" />
        )}
      </Container>
    </article>
  );
}
