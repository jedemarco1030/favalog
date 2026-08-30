"use client";

import { Search } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import {
  useEffect,
  useState,
  useTransition,
  type FormEvent,
  type ReactNode,
} from "react";
import { MediaCard } from "@/components/media/media-card";
import { EmptyState } from "@/components/ui/empty-state";
import {
  trackResultSelected,
  trackSearchOutcome,
  type TrackFn,
} from "@/lib/analytics/search-analytics";
import { cn } from "@/lib/cn";
import type { SearchKindFilter } from "@/lib/search/config";
import type { MediaKind } from "@/lib/types";
import type { SearchOutcome } from "@/lib/supabase/search-view-model";

interface FilterOption {
  value: SearchKindFilter;
  label: string;
}

const FILTER_OPTIONS: readonly FilterOption[] = [
  { value: "all", label: "All" },
  { value: "movie", label: "Movies" },
  { value: "tv", label: "TV" },
  { value: "book", label: "Books" },
] as const;

interface ExploreSearchProps {
  /** Committed query from the `q` URL parameter. */
  initialQuery: string;
  /** Committed kind filter from the `type` URL parameter. */
  initialFilter: SearchKindFilter;
  /**
   * The server-computed search outcome for the committed query, or `null` when
   * there is no active query (the editorial shelves are shown instead).
   */
  outcome: SearchOutcome | null;
  /** Editorial (example) shelves shown when no query is active. */
  defaultSections: ReactNode;
  /**
   * Streamed federated external-provider sections (Catalog Platform v1B),
   * rendered BELOW the local results for an active query. Already Suspense-
   * wrapped by the server page so provider latency never blocks local results;
   * `null` when external discovery is off/unavailable or there is no query.
   */
  externalSections?: ReactNode;
  /**
   * Injectable analytics transport (tests/stories). Defaults to the real
   * `@vercel/analytics` `track` inside the adapter when omitted.
   */
  analyticsTrack?: TrackFn;
}

/**
 * Explore's interactive search surface.
 *
 * Search runs on the SERVER per navigation (the page reads `?q=`/`?type=` and
 * calls the search service), so this component never triggers a paid embedding
 * request per keystroke: it only submits — via the form or a filter click —
 * which navigates to a shareable URL and lets the server re-render results.
 * The React transition drives a lightweight pending state while that happens.
 *
 * Raw similarity scores are never shown, and results are never labelled as
 * AI-generated.
 */
export function ExploreSearch({
  initialQuery,
  initialFilter,
  outcome,
  defaultSections,
  externalSections,
  analyticsTrack,
}: ExploreSearchProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [query, setQuery] = useState(initialQuery);
  const [filter, setFilter] = useState<SearchKindFilter>(initialFilter);
  const [isPending, startTransition] = useTransition();

  const inputId = "explore-search";
  const resultsHeadingId = "explore-results-heading";

  // Emit exactly one coarse, aggregate "search outcome rendered" product event
  // per committed search. The `outcome` prop reference only changes when the
  // server produces a new result (a navigation commit), so typing in the input
  // or toggling pending state never re-emits. Only successful outcomes carry a
  // mode/count; error/unavailable/empty states are not reported here.
  useEffect(() => {
    if (outcome && outcome.status === "ok") {
      trackSearchOutcome(
        {
          mode: outcome.mode,
          filter: outcome.kind,
          zeroResult: outcome.count === 0,
          resultCount: outcome.count,
        },
        analyticsTrack,
      );
    }
  }, [outcome, analyticsTrack]);

  function navigate(nextQuery: string, nextFilter: SearchKindFilter) {
    const params = new URLSearchParams();
    const trimmed = nextQuery.trim();
    if (trimmed) params.set("q", trimmed);
    if (nextFilter !== "all") params.set("type", nextFilter);
    const search = params.toString();
    startTransition(() => {
      router.push(search ? `${pathname}?${search}` : pathname, {
        scroll: false,
      });
    });
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    navigate(query, filter);
  }

  function onSelectFilter(next: SearchKindFilter) {
    setFilter(next);
    navigate(query, next);
  }

  const hasActiveQuery = outcome !== null;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4">
        <form role="search" onSubmit={onSubmit} className="relative w-full">
          <label htmlFor={inputId} className="sr-only">
            Search Favalog
          </label>
          <Search
            className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-foreground/50"
            aria-hidden="true"
          />
          <input
            id={inputId}
            name="q"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Try “a thoughtful sci-fi story about memory and grief”"
            autoComplete="off"
            aria-controls={resultsHeadingId}
            className="h-12 w-full rounded-full border border-border/70 bg-surface-1 pl-11 pr-28 text-base text-foreground placeholder:text-foreground/40 outline-none transition-colors focus:border-accent/60 focus-visible:ring-2 focus-visible:ring-accent"
          />
          <button
            type="submit"
            disabled={isPending}
            className="absolute right-2 top-1/2 inline-flex h-9 -translate-y-1/2 items-center rounded-full border border-accent/60 bg-accent/15 px-4 text-sm text-foreground transition-colors hover:bg-accent/25 disabled:opacity-60 outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            Search
          </button>
        </form>

        <fieldset className="flex flex-wrap items-center gap-2">
          <legend className="sr-only">Filter by media type</legend>
          {FILTER_OPTIONS.map((option) => {
            const selected = filter === option.value;
            return (
              <button
                key={option.value}
                type="button"
                aria-pressed={selected}
                onClick={() => onSelectFilter(option.value)}
                disabled={isPending}
                className={cn(
                  "inline-flex h-9 items-center rounded-full border px-3.5 text-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-60",
                  selected
                    ? "border-accent/60 bg-accent/15 text-foreground"
                    : "border-border/70 bg-surface-1 text-foreground/70 hover:text-foreground",
                )}
              >
                {option.label}
              </button>
            );
          })}
        </fieldset>
      </div>

      {hasActiveQuery ? (
        <div className="flex flex-col gap-16">
          <section aria-labelledby={resultsHeadingId} aria-busy={isPending}>
            <ExploreResults
              outcome={outcome}
              isPending={isPending}
              analyticsTrack={analyticsTrack}
            />
          </section>
          {externalSections}
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          <p className="text-sm text-foreground/50">
            Search the catalog above, or browse our editorial picks below.
          </p>
          {defaultSections}
        </div>
      )}
    </div>
  );
}

/** Render the discriminated search outcome into accessible result states. */
function ExploreResults({
  outcome,
  isPending,
  analyticsTrack,
}: {
  outcome: SearchOutcome;
  isPending: boolean;
  analyticsTrack?: TrackFn;
}) {
  if (outcome.status === "unavailable") {
    return (
      <EmptyState
        icon={Search}
        title="Search isn’t available right now."
        description="You can keep browsing the catalog while search comes back online."
      />
    );
  }

  if (outcome.status === "error") {
    return (
      <EmptyState
        icon={Search}
        title="Something went wrong."
        description="Please try your search again in a moment."
      />
    );
  }

  if (outcome.status === "empty") {
    return (
      <EmptyState
        icon={Search}
        title="Type something to search."
        description="Search by title, creator, genre, mood, or theme."
      />
    );
  }

  const { query, items, count, mode, kind } = outcome;

  // Report a coarse, aggregate "result selected" event on click. It fires
  // before navigation but is fully best-effort (never throws), so a blocked or
  // failing analytics transport can never prevent opening the title page. Only
  // the retrieval mode, filter, result kind, and a BUCKETED rank are sent.
  function onSelectResult(index: number, resultKind: MediaKind) {
    trackResultSelected(
      { mode, filter: kind, resultKind, index },
      analyticsTrack,
    );
  }

  return (
    <>
      <h2
        id="explore-results-heading"
        className={cn(
          "mb-6 font-display text-2xl tracking-tight text-foreground transition-opacity",
          isPending && "opacity-60",
        )}
      >
        Results for &ldquo;{query}&rdquo;
        <span className="ml-2 text-sm font-normal text-foreground/50 tabular-nums">
          {count}
        </span>
      </h2>
      {count === 0 ? (
        <EmptyState
          icon={Search}
          title="No matches yet."
          description="Try a different title, creator, genre, or a more descriptive phrase."
        />
      ) : (
        <ul
          role="list"
          className={cn(
            "grid grid-cols-2 gap-x-5 gap-y-8 transition-opacity sm:grid-cols-3 lg:grid-cols-5",
            isPending && "opacity-60",
          )}
        >
          {items.map((item, index) => (
            <li key={item.id}>
              <MediaCard
                item={item}
                onSelect={() => onSelectResult(index, item.kind)}
              />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
