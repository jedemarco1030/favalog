import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ExploreSearch } from "@/components/media/explore-search";
import { getMediaBySlug } from "@/lib/data";
import type { MediaItem } from "@/lib/types";
import type { SearchOutcome } from "@/lib/supabase/search-view-model";

/**
 * Explore's interactive search surface, driven by the SERVER-computed
 * `SearchOutcome`. These stories exercise its genuine states without importing
 * any `"use server"` module: navigation is auto-mocked by the Next.js Storybook
 * framework, and result fixtures reuse the `@/lib/data` mock catalog so the
 * cross-media `MediaCard`s render real, accessible titles.
 */

// A small, cross-media result set built from the mock catalog.
const results: MediaItem[] = [
  getMediaBySlug("dune-part-two")!,
  getMediaBySlug("afterglow")!,
  getMediaBySlug("northlight")!,
  getMediaBySlug("the-small-hours")!,
].filter(Boolean);

const okOutcome: SearchOutcome = {
  status: "ok",
  query: "memory and grief",
  kind: "all",
  mode: "hybrid",
  items: results,
  count: results.length,
};

const emptyOkOutcome: SearchOutcome = {
  status: "ok",
  query: "zxqv nonexistent title",
  kind: "all",
  mode: "hybrid",
  items: [],
  count: 0,
};

const keywordFallbackOutcome: SearchOutcome = {
  status: "ok",
  query: "space opera",
  kind: "all",
  mode: "keyword_fallback",
  items: results,
  count: results.length,
  fallbackReason: "timeout",
};

const unavailableOutcome: SearchOutcome = { status: "unavailable" };

const errorOutcome: SearchOutcome = { status: "error", category: "database" };

const defaultSections = (
  <div className="flex flex-col gap-4">
    <p className="text-xs font-medium uppercase tracking-wide text-foreground/40">
      Editorial examples — curated demonstration shelves
    </p>
    <ul role="list" className="flex flex-col gap-2 text-foreground/70">
      <li>Trending now</li>
      <li>Critically acclaimed</li>
      <li>Hidden gems</li>
    </ul>
  </div>
);

const meta = {
  title: "Media/ExploreSearch",
  component: ExploreSearch,
  parameters: { layout: "fullscreen" },
  args: {
    initialQuery: "",
    initialFilter: "all",
    outcome: null,
    defaultSections,
  },
} satisfies Meta<typeof ExploreSearch>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Successful hybrid search with several cross-media results. */
export const Results: Story = {
  args: {
    initialQuery: "memory and grief",
    initialFilter: "all",
    outcome: okOutcome,
  },
};

/** A committed query that matched nothing — an accessible "no matches" state. */
export const Empty: Story = {
  args: {
    initialQuery: "zxqv nonexistent title",
    initialFilter: "all",
    outcome: emptyOkOutcome,
  },
};

/**
 * Semantic retrieval was attempted but timed out, so keyword results were
 * returned instead. The UI never surfaces the fallback as an error.
 */
export const KeywordFallback: Story = {
  args: {
    initialQuery: "space opera",
    initialFilter: "all",
    outcome: keywordFallbackOutcome,
  },
};

/** Supabase is not configured — search is calmly unavailable, browsing stays. */
export const Unavailable: Story = {
  args: {
    initialQuery: "anything",
    initialFilter: "all",
    outcome: unavailableOutcome,
  },
};

/** The search failed safely with a controlled, non-sensitive message. */
export const Error: Story = {
  args: {
    initialQuery: "anything",
    initialFilter: "all",
    outcome: errorOutcome,
  },
};

/** No active query: the editorial example shelves are shown instead. */
export const Default: Story = {
  args: {
    initialQuery: "",
    initialFilter: "all",
    outcome: null,
  },
};
