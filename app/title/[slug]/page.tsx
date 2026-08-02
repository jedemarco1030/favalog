import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Container } from "@/components/ui/container";
import { MediaPoster } from "@/components/media/media-poster";
import { MediaTypeBadge, mediaKindLabel } from "@/components/media/media-type-badge";
import { RatingDisplay } from "@/components/ui/rating-display";
import { getMediaBySlug } from "@/lib/data";

interface TitlePageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({
  params,
}: TitlePageProps): Promise<Metadata> {
  const { slug } = await params;
  const item = getMediaBySlug(slug);
  if (!item) return {};
  return {
    title: item.title,
    description: item.synopsis,
  };
}

/**
 * Minimal detail-page placeholder at the stable `/title/[slug]` route.
 * `MediaCard`, `ActivityCard`, and `ReviewCard` already link here — this
 * page keeps those links honest while the full detail page (cast, reviews,
 * ratings breakdown, related titles) is built in a later pass.
 */
export default async function TitlePage({ params }: TitlePageProps) {
  const { slug } = await params;
  const item = getMediaBySlug(slug);
  if (!item) notFound();

  return (
    <Container className="py-16">
      <div className="flex flex-col gap-8 sm:flex-row sm:items-start">
        <MediaPoster
          item={item}
          sizes="240px"
          priority
          decorative
          className="w-40 shrink-0 sm:w-56"
        />
        <div className="flex min-w-0 flex-col gap-3">
          <div className="flex items-center gap-2">
            <MediaTypeBadge kind={item.kind} />
            <span className="text-sm text-foreground/50 tabular-nums">
              {item.year}
            </span>
          </div>
          <h1 className="font-display text-4xl tracking-tight text-foreground">
            {item.title}
          </h1>
          <RatingDisplay value={item.averageRating} size="md" />
          <p className="max-w-xl text-foreground/70">{item.synopsis}</p>
          <p className="mt-4 text-sm text-foreground/50">
            Full details, ratings, and reviews for this{" "}
            {mediaKindLabel(item.kind).toLowerCase()} are coming next.
          </p>
        </div>
      </div>
    </Container>
  );
}
