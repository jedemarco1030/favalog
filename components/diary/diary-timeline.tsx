"use client";

import { NotebookPen } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { DiaryEntry } from "@/components/diary/diary-entry";
import {
  DIARY_FILTER_OPTIONS,
  type DiaryEntryView,
  type DiaryFilter,
} from "@/components/diary/diary-view";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/cn";

interface DiaryTimelineProps {
  /**
   * The full diary, resolved and ordered newest-first by the Server
   * Component. The client only ever filters this array — it never re-reads
   * the data layer.
   */
  entries: DiaryEntryView[];
  /** Initial filter, sourced from the `type` URL parameter. */
  initialFilter: DiaryFilter;
}

const monthFormatter = new Intl.DateTimeFormat("en", {
  month: "long",
  year: "numeric",
});

interface MonthGroup {
  key: string;
  label: string;
  entries: DiaryEntryView[];
}

/**
 * Group already-sorted (newest-first) entries by calendar month, preserving
 * order. Grouping by month reads like a journal without the noise of a
 * per-day header on days with a single entry.
 */
function groupByMonth(entries: DiaryEntryView[]): MonthGroup[] {
  const groups: MonthGroup[] = [];
  let current: MonthGroup | null = null;
  for (const entry of entries) {
    const date = new Date(entry.loggedAt);
    const key = `${date.getFullYear()}-${date.getMonth()}`;
    if (!current || current.key !== key) {
      current = { key, label: monthFormatter.format(date), entries: [] };
      groups.push(current);
    }
    current.entries.push(entry);
  }
  return groups;
}

/**
 * Interactive diary surface for `/diary`.
 *
 * This is the only Client Component on the page: the heading, supporting
 * copy, and the activity summary all render on the server. Only the
 * media-type filter and the filtered, month-grouped list live here because
 * they react to user input. The selected filter mirrors to the URL
 * (`?type=…`) via `router.replace` so a filtered diary is shareable and back
 * / forward behaves naturally; `type=all` is omitted to keep the URL clean.
 */
export function DiaryTimeline({ entries, initialFilter }: DiaryTimelineProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [filter, setFilter] = useState<DiaryFilter>(initialFilter);

  const filtered = useMemo(
    () =>
      filter === "all"
        ? entries
        : entries.filter((entry) => entry.kind === filter),
    [entries, filter],
  );

  const groups = useMemo(() => groupByMonth(filtered), [filtered]);

  const activeOption =
    DIARY_FILTER_OPTIONS.find((option) => option.value === filter) ??
    DIARY_FILTER_OPTIONS[0];

  // Mirror the active filter to the URL without adding history noise.
  const isFirstSync = useRef(true);
  useEffect(() => {
    if (isFirstSync.current) {
      isFirstSync.current = false;
      return;
    }
    const params = new URLSearchParams();
    if (filter !== "all") params.set("type", filter);
    const search = params.toString();
    router.replace(search ? `${pathname}?${search}` : pathname, {
      scroll: false,
    });
  }, [pathname, router, filter]);

  return (
    <div className="flex flex-col gap-8">
      <fieldset className="flex flex-wrap items-center gap-2">
        <legend className="sr-only">Filter diary by media type</legend>
        {DIARY_FILTER_OPTIONS.map((option) => {
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

      {groups.length === 0 ? (
        <EmptyState icon={NotebookPen} title={activeOption.emptyLabel} />
      ) : (
        <div className="flex flex-col gap-10">
          {groups.map((group) => (
            <section key={group.key} aria-labelledby={`diary-${group.key}`}>
              <h2
                id={`diary-${group.key}`}
                className="mb-5 font-display text-sm font-medium uppercase tracking-widest text-foreground/40"
              >
                {group.label}
              </h2>
              <ul role="list" className="flex flex-col">
                {group.entries.map((entry) => (
                  <li
                    key={entry.id}
                    className="border-t border-border/40 py-5 first:border-t-0 first:pt-0"
                  >
                    <DiaryEntry entry={entry} />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
