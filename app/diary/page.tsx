import type { Metadata } from "next";
import { NotebookPen } from "lucide-react";
import { Container } from "@/components/ui/container";
import { EmptyState } from "@/components/ui/empty-state";
import { DiarySummary } from "@/components/diary/diary-summary";
import { DiaryTimeline } from "@/components/diary/diary-timeline";
import {
  type DiaryEntryView,
  type DiaryFilter,
} from "@/components/diary/diary-view";
import {
  getDiaryEntriesForUser,
  getDiaryEntryMedia,
  getDiarySummary,
  getReviewById,
} from "@/lib/data";
import type { DiaryEntry } from "@/lib/types";

export const metadata: Metadata = {
  title: "Diary",
  description: "A record of everything you've watched and read.",
};

const VALID_FILTERS: ReadonlySet<DiaryFilter> = new Set([
  "all",
  "movie",
  "tv",
  "book",
]);

function parseFilter(raw: string | string[] | undefined): DiaryFilter {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (value && VALID_FILTERS.has(value as DiaryFilter)) {
    return value as DiaryFilter;
  }
  return "all";
}

/** Trim a review body to a short, one-line excerpt on a word boundary. */
function excerptOf(body: string, max = 120): string {
  if (body.length <= max) return body;
  const clipped = body.slice(0, max);
  const lastSpace = clipped.lastIndexOf(" ");
  return `${clipped.slice(0, lastSpace > 0 ? lastSpace : max)}…`;
}

/**
 * Resolve a raw `DiaryEntry` into the flat, serializable view model the
 * client timeline renders. Media is looked up by `mediaId` and any review by
 * `reviewId` here on the server, so the Client Component never touches the
 * data layer. Returns `null` for orphaned entries so they are skipped.
 */
function toView(entry: DiaryEntry): DiaryEntryView | null {
  const media = getDiaryEntryMedia(entry);
  if (!media) return null;

  const review = entry.reviewId ? getReviewById(entry.reviewId) : undefined;

  return {
    id: entry.id,
    loggedAt: entry.loggedAt,
    kind: media.kind,
    action: entry.action ?? (media.kind === "book" ? "read" : "watched"),
    rating: entry.rating,
    slug: media.slug,
    title: media.title,
    year: media.year,
    posterUrl: media.posterUrl,
    review: review
      ? { title: review.title, excerpt: excerptOf(review.body) }
      : undefined,
  };
}

/**
 * `/diary` — a unified, chronological entertainment diary.
 *
 * Movies, TV, and books share one newest-first timeline grouped by month.
 * The page is server-first: the header, the derived activity summary, and the
 * entire resolved entry list render on the server. Only the media-type filter
 * and the list it drives are hydrated as a Client Component (`DiaryTimeline`).
 */
export default async function DiaryPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string | string[] }>;
}) {
  const params = await searchParams;
  const initialFilter = parseFilter(params.type);

  const entries = getDiaryEntriesForUser();
  const views = entries
    .map(toView)
    .filter((view): view is DiaryEntryView => view !== null);
  const summary = getDiarySummary();

  return (
    <Container className="py-10 md:py-14">
      <header className="max-w-2xl">
        <h1 className="font-display text-4xl leading-tight tracking-tight text-foreground sm:text-5xl">
          Diary
        </h1>
        <p className="mt-3 text-base text-foreground/70">
          A record of everything you&rsquo;ve watched and read.
        </p>
        {summary.total > 0 && (
          <DiarySummary summary={summary} className="mt-5" />
        )}
      </header>

      <div className="mt-10">
        {views.length === 0 ? (
          <EmptyState
            icon={NotebookPen}
            title="Your diary is empty."
            description="Titles you log will show up here, newest first."
          />
        ) : (
          <DiaryTimeline entries={views} initialFilter={initialFilter} />
        )}
      </div>
    </Container>
  );
}
