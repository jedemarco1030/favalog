import type { Metadata } from "next";
import Link from "next/link";
import { Compass, NotebookPen, TriangleAlert } from "lucide-react";
import { Container } from "@/components/ui/container";
import { EmptyState } from "@/components/ui/empty-state";
import { DiarySummary } from "@/components/diary/diary-summary";
import { DiaryTimeline } from "@/components/diary/diary-timeline";
import {
  excerptOf,
  summarizeDiaryViews,
  type DiaryEntryView,
  type DiaryFilter,
} from "@/components/diary/diary-view";
import {
  getDiaryEntriesForUser,
  getDiaryEntryMedia,
  getReviewById,
} from "@/lib/data";
import { getMyDiary } from "@/lib/supabase/diary";
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

/**
 * Resolve a raw mock `DiaryEntry` into the serializable view model. Used ONLY
 * for the signed-out example diary; the authenticated diary is resolved from
 * Supabase by `getMyDiary()`.
 */
function toExampleView(entry: DiaryEntry): DiaryEntryView | null {
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
 * `/diary` — a unified, chronological entertainment diary whose data source
 * depends on the viewer.
 *
 * A signed-in, onboarded user sees their REAL Supabase diary (owner-scoped,
 * newest first, resolved to the same `DiaryEntryView` shape). A signed-out
 * visitor — or any no-Supabase environment — sees the mock diary as a clearly
 * labelled PRODUCT DEMO, never presented as their own, with a sign-in CTA. A
 * database error shows a safe error state rather than silently falling back to
 * the mock diary (which would misattribute someone else's entries).
 */
export default async function DiaryPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string | string[] }>;
}) {
  const params = await searchParams;
  const initialFilter = parseFilter(params.type);

  const result = await getMyDiary();

  if (result.status === "ok") {
    return <RealDiary entries={result.entries} initialFilter={initialFilter} />;
  }

  if (result.status === "error") {
    return <DiaryError />;
  }

  // signed-out or Supabase-unavailable: the public example diary.
  return <ExampleDiary initialFilter={initialFilter} />;
}

function DiaryHeader({ children }: { children?: React.ReactNode }) {
  return (
    <header className="max-w-2xl">
      <h1 className="font-display text-4xl leading-tight tracking-tight text-foreground sm:text-5xl">
        Diary
      </h1>
      {children}
    </header>
  );
}

/** The authenticated user's real diary. */
function RealDiary({
  entries,
  initialFilter,
}: {
  entries: DiaryEntryView[];
  initialFilter: DiaryFilter;
}) {
  const summary = summarizeDiaryViews(entries);

  return (
    <Container className="py-10 md:py-14">
      <DiaryHeader>
        <p className="mt-3 text-base text-foreground/70">
          A record of everything you&rsquo;ve watched and read.
        </p>
        {summary.total > 0 && (
          <DiarySummary summary={summary} className="mt-5" />
        )}
      </DiaryHeader>

      <div className="mt-10">
        {entries.length === 0 ? (
          <EmptyState
            icon={NotebookPen}
            title="Your diary is empty."
            description="Titles you log, rate, and review will appear here, newest first."
            action={
              <Link
                href="/explore"
                className="inline-flex items-center gap-2 rounded-full border border-accent/40 bg-accent/10 px-4 py-2 text-sm font-medium text-accent outline-none transition-colors hover:bg-accent/15 focus-visible:ring-2 focus-visible:ring-accent"
              >
                <Compass className="size-4" aria-hidden="true" />
                Explore titles to log
              </Link>
            }
          />
        ) : (
          <DiaryTimeline entries={entries} initialFilter={initialFilter} />
        )}
      </div>
    </Container>
  );
}

/** Public, clearly-labelled example diary for signed-out / no-env visitors. */
function ExampleDiary({ initialFilter }: { initialFilter: DiaryFilter }) {
  const views = getDiaryEntriesForUser()
    .map(toExampleView)
    .filter((view): view is DiaryEntryView => view !== null);
  const summary = summarizeDiaryViews(views);

  return (
    <Container className="py-10 md:py-14">
      <DiaryHeader>
        <p className="mt-2 inline-flex items-center rounded-full border border-border/70 bg-surface-2 px-3 py-1 text-xs font-medium uppercase tracking-wide text-foreground/60">
          Example diary
        </p>
        <p className="mt-3 text-base text-foreground/70">
          See how your Favalog will come together. This is sample content —{" "}
          <Link
            href="/auth/sign-up"
            className="text-accent underline-offset-4 hover:underline"
          >
            create an account
          </Link>{" "}
          or{" "}
          <Link
            href="/auth/sign-in?returnTo=%2Fdiary"
            className="text-accent underline-offset-4 hover:underline"
          >
            sign in
          </Link>{" "}
          to start your own.
        </p>
        {summary.total > 0 && (
          <DiarySummary summary={summary} className="mt-5" />
        )}
      </DiaryHeader>

      <div className="mt-10">
        <DiaryTimeline entries={views} initialFilter={initialFilter} />
      </div>
    </Container>
  );
}

/** Safe error state — never leaks a raw database error or mock data. */
function DiaryError() {
  return (
    <Container className="py-10 md:py-14">
      <DiaryHeader />
      <div className="mt-10">
        <EmptyState
          icon={TriangleAlert}
          title="We couldn't load your diary."
          description="Something went wrong reaching your Favalog. Please try again in a moment."
          action={
            <div className="flex flex-wrap items-center gap-3">
              <Link
                href="/diary"
                className="inline-flex items-center rounded-full border border-border/70 bg-surface-1 px-4 py-2 text-sm font-medium text-foreground outline-none transition-colors hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-accent"
              >
                Try again
              </Link>
              <Link
                href="/explore"
                className="inline-flex items-center gap-2 rounded-full border border-accent/40 bg-accent/10 px-4 py-2 text-sm font-medium text-accent outline-none transition-colors hover:bg-accent/15 focus-visible:ring-2 focus-visible:ring-accent"
              >
                <Compass className="size-4" aria-hidden="true" />
                Explore
              </Link>
            </div>
          }
        />
      </div>
    </Container>
  );
}
