"use client";

import { Library } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition, type ChangeEvent, type ReactNode } from "react";
import { MediaCard } from "@/components/media/media-card";
import { EmptyState } from "@/components/ui/empty-state";
import { StyledSelect } from "@/components/ui/styled-select";
import { cn } from "@/lib/cn";
import { BROWSE_SORTS, type BrowseSort } from "@/lib/browse/query";
import type { BrowseOutcome } from "@/lib/supabase/browse-view-model";

/** Human labels for each global browse sort, in display order. */
const SORT_LABELS: Record<BrowseSort, string> = {
  recently_added: "Recently added",
  highest_rated: "Highest rated",
  newest: "Newest release",
  oldest: "Oldest release",
  title_asc: "Title A–Z",
};

interface CatalogBrowseProps {
  /** Server-computed browse outcome for the committed URL state. */
  outcome: BrowseOutcome;
}

/**
 * The real, server-backed catalog browser shown on `/explore` when Supabase is
 * configured and no search query is active.
 *
 * All heavy lifting (ordering, filtering, pagination, genre reconciliation)
 * happens on the SERVER; this component only reflects the committed `outcome`
 * and drives NAVIGATION. Changing the sort or genre, or paging, pushes a new
 * shareable URL and lets the server re-render — so state always restores
 * correctly from the URL and is fully shareable. The media-type filter lives in
 * the shared search header above (the `type` parameter), which this component
 * deliberately preserves when it rebuilds the URL.
 *
 * These GLOBAL sorts apply to browse only. Search results keep their evaluated
 * hybrid relevance order and expose no sort control, so the two modes never
 * present a misleading "sorted" view of a limited result set.
 */
export function CatalogBrowse({ outcome }: CatalogBrowseProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const regionHeadingId = "explore-browse-heading";

  /** Push a new URL preserving all params except the ones we mutate here. */
  function navigate(mutate: (params: URLSearchParams) => void) {
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    mutate(params);
    const search = params.toString();
    startTransition(() => {
      router.push(search ? `${pathname}?${search}` : pathname, {
        scroll: false,
      });
    });
  }

  function onSortChange(event: ChangeEvent<HTMLSelectElement>) {
    const next = event.target.value;
    navigate((params) => {
      params.set("sort", next);
      params.delete("page"); // a new sort resets to the first page
    });
  }

  function onGenreChange(event: ChangeEvent<HTMLSelectElement>) {
    const next = event.target.value;
    navigate((params) => {
      if (next) params.set("genre", next);
      else params.delete("genre");
      params.delete("page"); // a new genre resets to the first page
    });
  }

  function goToPage(page: number) {
    navigate((params) => {
      if (page <= 1) params.delete("page");
      else params.set("page", String(page));
    });
  }

  if (outcome.status === "unavailable") {
    return (
      <BrowseShell headingId={regionHeadingId}>
        <EmptyState
          icon={Library}
          title="Browsing isn’t available right now."
          description="You can keep exploring while the catalog comes back online."
        />
      </BrowseShell>
    );
  }

  if (outcome.status === "error") {
    return (
      <BrowseShell headingId={regionHeadingId}>
        <EmptyState
          icon={Library}
          title="Something went wrong."
          description="Please refresh in a moment to browse the catalog."
        />
      </BrowseShell>
    );
  }

  const { items, sort, appliedGenre, availableGenres, pagination } = outcome;
  const { page, totalCount, totalPages, hasPrev, hasNext } = pagination;

  return (
    <BrowseShell headingId={regionHeadingId} isPending={isPending}>
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <p
            className="text-sm text-foreground/60 tabular-nums"
            aria-live="polite"
          >
            {totalCount} {totalCount === 1 ? "title" : "titles"}
          </p>

          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-foreground/70">
              <span>Genre</span>
              <StyledSelect
                aria-label="Genre"
                value={appliedGenre ?? ""}
                onChange={onGenreChange}
                disabled={isPending || availableGenres.length === 0}
              >
                <option value="">All genres</option>
                {availableGenres.map((genre) => (
                  <option key={genre} value={genre}>
                    {genre}
                  </option>
                ))}
              </StyledSelect>
            </label>

            <label className="flex items-center gap-2 text-sm text-foreground/70">
              <span>Sort</span>
              <StyledSelect
                aria-label="Sort"
                value={sort}
                onChange={onSortChange}
                disabled={isPending}
              >
                {BROWSE_SORTS.map((option) => (
                  <option key={option} value={option}>
                    {SORT_LABELS[option]}
                  </option>
                ))}
              </StyledSelect>
            </label>
          </div>
        </div>

        {items.length === 0 ? (
          <EmptyState
            icon={Library}
            title="No titles match these filters."
            description="Try a different media type or genre."
          />
        ) : (
          <>
            <ul
              role="list"
              className={cn(
                "grid grid-cols-2 gap-x-5 gap-y-8 transition-opacity sm:grid-cols-3 lg:grid-cols-5",
                isPending && "opacity-60",
              )}
            >
              {items.map((item) => (
                <li key={item.id}>
                  <MediaCard item={item} />
                </li>
              ))}
            </ul>

            {totalPages > 1 && (
              <nav
                aria-label="Catalog pages"
                className="flex items-center justify-center gap-4"
              >
                <button
                  type="button"
                  onClick={() => goToPage(page - 1)}
                  disabled={!hasPrev || isPending}
                  className="inline-flex h-9 items-center rounded-full border border-border/70 bg-surface-1 px-4 text-sm text-foreground/80 transition-colors hover:text-foreground disabled:opacity-40 outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  Previous
                </button>
                <span
                  className="text-sm text-foreground/60 tabular-nums"
                  aria-current="page"
                >
                  Page {page} of {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => goToPage(page + 1)}
                  disabled={!hasNext || isPending}
                  className="inline-flex h-9 items-center rounded-full border border-border/70 bg-surface-1 px-4 text-sm text-foreground/80 transition-colors hover:text-foreground disabled:opacity-40 outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  Next
                </button>
              </nav>
            )}
          </>
        )}
      </div>
    </BrowseShell>
  );
}

/** Shared labelled region wrapper so every browse state is announced the same. */
function BrowseShell({
  headingId,
  isPending,
  children,
}: {
  headingId: string;
  isPending?: boolean;
  children: ReactNode;
}) {
  return (
    <section
      aria-labelledby={headingId}
      aria-busy={isPending}
      className="flex flex-col gap-6"
    >
      <h2 id={headingId} className="sr-only">
        Browse the catalog
      </h2>
      {children}
    </section>
  );
}
