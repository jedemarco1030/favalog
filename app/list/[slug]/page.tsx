import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Container } from "@/components/ui/container";
import { ListHeader } from "@/components/lists/list-header";
import { ListItemRow } from "@/components/lists/list-item-row";
import { ListSection } from "@/components/lists/list-section";
import { toListCardView } from "@/components/lists/to-list-card-view";
import type { ListCardView } from "@/components/lists/list-view";
import { RealListDetail } from "@/components/lists/real-list-detail";
import {
  getListBySlug,
  getListItemNote,
  getListMedia,
  getListsByUser,
  getPopularLists,
  getUserById,
} from "@/lib/data";
import { getRealListBySlug } from "@/lib/supabase/lists";
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

  // Real (persistent) lists take precedence. A private/unauthorized/unknown
  // real list resolves to `not-found` via RLS, so metadata never reveals a
  // private list's existence to an unauthorized viewer.
  const real = await getRealListBySlug(slug);
  if (real.status === "ok") {
    const { list: realList } = real;
    const realDescription =
      realList.description ??
      `A cross-media collection by ${realList.owner.displayName} on ${siteConfig.name}.`;
    return {
      title: realList.title,
      description: realDescription,
      openGraph: {
        type: "article",
        title: `${realList.title} — a list by ${realList.owner.displayName}`,
        description: realDescription,
        url: `/list/${realList.slug}`,
        siteName: siteConfig.name,
      },
    };
  }

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

  // Deterministic resolution: a real (persistent) list wins on its globally
  // unique slug. Private/unauthorized/unknown real lists resolve to not-found
  // (RLS), so we fall through to the mock demonstration lists without ever
  // disclosing whether a private list exists. Unknown everywhere => notFound().
  const real = await getRealListBySlug(slug);
  if (real.status === "ok") {
    return <RealListDetail list={real.list} />;
  }

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
