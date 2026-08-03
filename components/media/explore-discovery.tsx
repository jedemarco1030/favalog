"use client";

import { Search } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { MediaCard } from "@/components/media/media-card";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/cn";
import type { MediaItem, MediaKind } from "@/lib/types";

/**
 * Filter values understood by Explore. `all` is a UI-only sentinel that
 * disables kind filtering. Keeping this narrow keeps the URL surface small.
 */
export type ExploreFilter = "all" | MediaKind;

interface FilterOption {
  value: ExploreFilter;
  label: string;
}

const FILTER_OPTIONS: readonly FilterOption[] = [
  { value: "all", label: "All" },
  { value: "movie", label: "Movies" },
  { value: "tv", label: "TV" },
  { value: "book", label: "Books" },
] as const;

interface ExploreDiscoveryProps {
  /**
   * Full mock catalog, pre-flattened by the Server Component. The client
   * never re-imports raw data — it only filters the array it was given.
   */
  items: MediaItem[];
  /**
   * Pre-computed search haystack strings, keyed by media id. Building this
   * on the server keeps the client free of any knowledge of which
   * discriminant carries which credit (director / creators / authors).
   */
  haystack: Record<string, string>;
  /** Initial search query, sourced from the `q` URL parameter. */
  initialQuery: string;
  /** Initial filter, sourced from the `type` URL parameter. */
  initialFilter: ExploreFilter;
  /** Editorial shelves shown when no meaningful search query is active. */
  defaultSections: ReactNode;
}

/**
 * Interactive discovery surface for `/explore`.
 *
 * This is the only Client Component on the page. The heading, hero copy,
 * and every editorial shelf continue to render as Server Components; only
 * the search input, the media-type filter, and the results grid live here
 * because they need to react to user input.
 *
 * Query and filter state is mirrored to the URL (`?q=…&type=…`) via a
 * `router.replace` on debounced input change so Explore searches are
 * shareable and browser navigation behaves naturally.
 */
export function ExploreDiscovery({
  items,
  haystack,
  initialQuery,
  initialFilter,
  defaultSections,
}: ExploreDiscoveryProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [query, setQuery] = useState(initialQuery);
  const [filter, setFilter] = useState<ExploreFilter>(initialFilter);
  const resultsHeadingId = "explore-results-heading";
  const inputId = "explore-search";

  const trimmedQuery = query.trim();
  const hasQuery = trimmedQuery.length > 0;

  const results = useMemo(() => {
    const kindFiltered =
      filter === "all" ? items : items.filter((item) => item.kind === filter);
    if (!hasQuery) return kindFiltered;
    const needle = trimmedQuery.toLowerCase();
    return kindFiltered.filter((item) => {
      const hay = haystack[item.id];
      return hay ? hay.includes(needle) : false;
    });
  }, [items, haystack, filter, hasQuery, trimmedQuery]);

  // Sync URL query params (debounced) without adding history entries.
  const isFirstSync = useRef(true);
  useEffect(() => {
    if (isFirstSync.current) {
      isFirstSync.current = false;
      return;
    }
    const handle = window.setTimeout(() => {
      const params = new URLSearchParams();
      if (trimmedQuery) params.set("q", trimmedQuery);
      if (filter !== "all") params.set("type", filter);
      const search = params.toString();
      router.replace(search ? `${pathname}?${search}` : pathname, {
        scroll: false,
      });
    }, 200);
    return () => window.clearTimeout(handle);
  }, [pathname, router, trimmedQuery, filter]);

  const onSubmit = useCallback((event: React.FormEvent<HTMLFormElement>) => {
    // The list already updates as the user types; the form is only here to
    // give the search a native container and to swallow Enter presses so
    // the page never reloads.
    event.preventDefault();
  }, []);

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
            placeholder="Search movies, shows, books..."
            autoComplete="off"
            aria-controls={resultsHeadingId}
            className="h-12 w-full rounded-full border border-border/70 bg-surface-1 pl-11 pr-4 text-base text-foreground placeholder:text-foreground/40 outline-none transition-colors focus:border-accent/60 focus-visible:ring-2 focus-visible:ring-accent"
          />
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
                onClick={() => setFilter(option.value)}
                className={cn(
                  "inline-flex h-9 items-center rounded-full border px-3.5 text-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-accent",
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

      {hasQuery ? (
        <section aria-labelledby={resultsHeadingId}>
          <h2
            id={resultsHeadingId}
            className="mb-6 font-display text-2xl tracking-tight text-foreground"
          >
            Results for &ldquo;{trimmedQuery}&rdquo;
            <span className="ml-2 text-sm font-normal text-foreground/50 tabular-nums">
              {results.length}
            </span>
          </h2>
          {results.length === 0 ? (
            <EmptyState
              icon={Search}
              title="No matches yet."
              description="Try a different title, creator, or genre."
            />
          ) : (
            <ul
              role="list"
              className="grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 lg:grid-cols-5"
            >
              {results.map((item) => (
                <li key={item.id}>
                  <MediaCard item={item} />
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : filter !== "all" ? (
        <section aria-label="Filtered results">
          {results.length === 0 ? (
            <EmptyState
              title="Nothing to show here yet."
              description="Try switching back to All."
            />
          ) : (
            <ul
              role="list"
              className="grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 lg:grid-cols-5"
            >
              {results.map((item) => (
                <li key={item.id}>
                  <MediaCard item={item} />
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : (
        defaultSections
      )}
    </div>
  );
}
