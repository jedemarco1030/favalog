import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MessageSquare } from "lucide-react";
import { Container } from "@/components/ui/container";
import { SectionHeader } from "@/components/ui/section-header";
import { EmptyState } from "@/components/ui/empty-state";
import { MediaCard } from "@/components/media/media-card";
import { MediaHero } from "@/components/media/media-hero";
import {
  MediaActions,
  type AddToListState,
  type FavoriteState,
} from "@/components/media/media-actions";
import { MediaDetails } from "@/components/media/media-details";
import { RatingBreakdown } from "@/components/media/rating-breakdown";
import { ReviewCard } from "@/components/reviews/review-card";
import {
  getMediaBySlug,
  getRatingDistribution,
  getRelatedMedia,
  getReviewsForMedia,
  getUserById,
} from "@/lib/data";
import { mediaKindLabel } from "@/components/media/media-type-badge";
import { isAuthAvailable } from "@/lib/auth/capability";
import { getCurrentUser } from "@/lib/auth/data";
import { getRealMediaBySlug } from "@/lib/supabase/media";
import { getMyLatestLogForSlug } from "@/lib/supabase/diary";
import { getMyListsWithMembership } from "@/lib/supabase/lists";
import { getMyFavoriteState } from "@/lib/supabase/favorites";
import { siteConfig } from "@/lib/site-config";

interface TitlePageProps {
  params: Promise<{ slug: string }>;
}

/**
 * Per-title metadata: page title, description, and matching Open Graph
 * tags. The root layout already sets a `%s · Favalog` template, so we only
 * pass the bare title here. `openGraph.url` uses the stable slug route.
 */
export async function generateMetadata({
  params,
}: TitlePageProps): Promise<Metadata> {
  const { slug } = await params;
  const item = getMediaBySlug(slug) ?? (await getRealMediaBySlug(slug));
  if (!item) {
    return { title: "Title not found" };
  }

  const kindLabel = mediaKindLabel(item.kind).toLowerCase();
  const description = item.synopsis;
  const ogTitle = `${item.title} (${item.year}) — ${kindLabel} on ${siteConfig.name}`;

  return {
    title: item.title,
    description,
    openGraph: {
      type: "article",
      title: ogTitle,
      description,
      url: `/title/${item.slug}`,
      siteName: siteConfig.name,
      images: item.backdropUrl ?? item.posterUrl,
    },
    twitter: {
      card: "summary_large_image",
      title: ogTitle,
      description,
    },
  };
}

/**
 * Unified `/title/[slug]` detail experience for every `MediaItem` kind
 * (movie, tv, book). One route, one composable page — media-type-specific
 * concerns are handled by narrowing inside small focused components
 * (`MediaHero`, `MediaDetails`) rather than by forking the page.
 *
 * Invalid slugs use Next.js `notFound()` so the site-wide `app/not-found.tsx`
 * renders inside the normal chrome.
 */
export default async function TitlePage({ params }: TitlePageProps) {
  const { slug } = await params;
  // Resolve from the mock catalog first; fall back to a real Supabase title so a
  // freshly MATERIALIZED external title (Catalog Platform v1B) — which exists
  // only in `media_items` — resolves at its canonical route with the existing
  // Log / Rate / Review / Favorite / Add-to-list actions working unchanged.
  const item = getMediaBySlug(slug) ?? (await getRealMediaBySlug(slug));
  if (!item) notFound();

  const distribution = getRatingDistribution(item.id);
  const titleReviews = getReviewsForMedia(item.id);
  const related = getRelatedMedia(item.id, 6);

  // Personal, per-viewer state. Community reviews/ratings above stay on the
  // mock layer this phase; this is the viewer's OWN most-recent log (or null
  // when signed out / not yet logged / unavailable), kept visually separate.
  // Only touch the auth DAL when Supabase is configured so a no-env build
  // never constructs a client (which would throw) — the actions then fall
  // back to the safe signed-out sign-in flow.
  const viewer = isAuthAvailable() ? await getCurrentUser() : null;
  const personalResult = await getMyLatestLogForSlug(item.slug);
  const personal =
    personalResult.status === "logged" ? personalResult.entry : null;
  const returnTo = `/title/${item.slug}`;
  const signInHref = `/auth/sign-in?returnTo=${encodeURIComponent(returnTo)}`;

  // The viewer's own lists + this-title membership for the Add-to-list dialog.
  // Only fetched for an authenticated viewer; the read is owner-scoped by RLS
  // and returns serializable view models, never raw rows. A read error becomes
  // a controlled in-dialog error state rather than a crash or fake success.
  let addToList: AddToListState | null = null;
  if (viewer !== null) {
    const membership = await getMyListsWithMembership(item.slug);
    if (membership.status === "ok") {
      addToList = {
        mediaKnown: membership.mediaKnown,
        lists: membership.lists,
      };
    } else if (membership.status === "error") {
      addToList = {
        mediaKnown: false,
        lists: [],
        error:
          "We couldn't load your lists just now. Please try again in a moment.",
      };
    } else {
      addToList = { mediaKnown: false, lists: [] };
    }
  }

  // The viewer's persisted favorite state for this title. Only fetched for an
  // authenticated viewer; the read is owner-scoped by auth.uid(). A read error,
  // an unknown catalog slug, or an unavailable environment all collapse to a
  // controlled unavailable state (mediaKnown: false) rather than a crash or a
  // fake "Favorited". Signed-out visitors get a neutral sign-in affordance.
  let favorite: FavoriteState | null = null;
  if (viewer !== null) {
    const favoriteState = await getMyFavoriteState(item.slug);
    favorite =
      favoriteState.status === "ok"
        ? {
            isFavorite: favoriteState.isFavorite,
            mediaKnown: favoriteState.mediaKnown,
          }
        : { isFavorite: false, mediaKnown: false };
  }

  return (
    <article>
      <Container>
        <MediaHero item={item} ratingCount={distribution?.count} />
      </Container>

      <Container className="pb-16">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-12">
          <div className="flex flex-col gap-12">
            <section aria-label="Actions">
              <MediaActions
                item={item}
                isAuthenticated={viewer !== null}
                returnTo={returnTo}
                signInHref={signInHref}
                personal={personal}
                addToList={addToList}
                favorite={favorite}
              />
            </section>

            <section>
              <SectionHeader
                as="h2"
                title="Details"
                description={detailsDescription(item.kind)}
              />
              <MediaDetails item={item} />
            </section>

            <section>
              <SectionHeader
                as="h2"
                title="Popular reviews"
                description={
                  titleReviews.length > 0
                    ? "What the community is saying."
                    : undefined
                }
              />
              {titleReviews.length > 0 ? (
                <ul className="flex flex-col gap-4">
                  {titleReviews.map((review) => {
                    const author = getUserById(review.userId);
                    if (!author) return null;
                    return (
                      <li key={review.id}>
                        <ReviewCard
                          review={review}
                          user={author}
                          media={item}
                        />
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <EmptyState
                  icon={MessageSquare}
                  title="No reviews yet"
                  description={`Be the first to share what you thought of this ${mediaKindLabel(
                    item.kind,
                  ).toLowerCase()}.`}
                />
              )}
            </section>
          </div>

          <aside className="flex flex-col gap-8">
            {distribution && (
              <section>
                <SectionHeader as="h2" title="Community rating" />
                <RatingBreakdown distribution={distribution} />
              </section>
            )}
          </aside>
        </div>

        {related.length > 0 && (
          <section className="mt-16">
            <SectionHeader
              as="h2"
              title="More like this"
              description="Related titles across films, series, and books."
            />
            <ul className="grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 lg:grid-cols-6">
              {related.map((relatedItem) => (
                <li key={relatedItem.id}>
                  <MediaCard item={relatedItem} />
                </li>
              ))}
            </ul>
          </section>
        )}
      </Container>
    </article>
  );
}

function detailsDescription(kind: "movie" | "tv" | "book"): string {
  switch (kind) {
    case "movie":
      return "Credits, runtime, and cast.";
    case "tv":
      return "Creators, seasons, and cast.";
    case "book":
      return "Author, publication, and publisher.";
  }
}
