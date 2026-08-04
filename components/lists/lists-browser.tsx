"use client";

import { Search } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { ListCard } from "@/components/lists/list-card";
import { LIST_GRID_CLASS } from "@/components/lists/list-section";
import type { ListCardView } from "@/components/lists/list-view";
import { EmptyState } from "@/components/ui/empty-state";

interface ListsBrowserProps {
  /**
   * Every list, pre-resolved to card view models on the server. The client
   * only filters the array it is given — it never imports the data layer.
   */
  lists: ListCardView[];
  /**
   * Pre-computed lowercase search haystack per list id (title, description,
   * and creator), built on the server so the client stays storage-agnostic.
   */
  haystack: Record<string, string>;
  /** Curated, grouped sections shown when no search query is active. */
  defaultSections: ReactNode;
}

/**
 * Interactive discovery surface for `/lists`.
 *
 * This is the only Client Component on the page. The header and every curated
 * section render as Server Components; only the search field and its results
 * grid live here. Search is intentionally lightweight and local — it matches
 * a list's title, description, and creator against the pre-built haystack — so
 * the page stays discovery-first without a search library or URL state.
 */
export function ListsBrowser({
  lists,
  haystack,
  defaultSections,
}: ListsBrowserProps) {
  const [query, setQuery] = useState("");
  const inputId = "lists-search";
  const resultsHeadingId = "lists-results-heading";

  const trimmedQuery = query.trim();
  const hasQuery = trimmedQuery.length > 0;

  const results = useMemo(() => {
    if (!hasQuery) return [];
    const needle = trimmedQuery.toLowerCase();
    return lists.filter((list) => {
      const hay = haystack[list.id];
      return hay ? hay.includes(needle) : false;
    });
  }, [lists, haystack, hasQuery, trimmedQuery]);

  return (
    <div className="flex flex-col gap-10">
      <form
        role="search"
        onSubmit={(event) => event.preventDefault()}
        className="relative w-full max-w-xl"
      >
        <label htmlFor={inputId} className="sr-only">
          Search lists
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
          placeholder="Search lists by title, description, or creator..."
          autoComplete="off"
          aria-controls={resultsHeadingId}
          className="h-12 w-full rounded-full border border-border/70 bg-surface-1 pl-11 pr-4 text-base text-foreground placeholder:text-foreground/40 outline-none transition-colors focus:border-accent/60 focus-visible:ring-2 focus-visible:ring-accent"
        />
      </form>

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
              title="No lists match that search."
              description="Try a different title, description, or creator."
            />
          ) : (
            <ul role="list" className={LIST_GRID_CLASS}>
              {results.map((list) => (
                <li key={list.id}>
                  <ListCard list={list} />
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
