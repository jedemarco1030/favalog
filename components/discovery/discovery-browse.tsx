import Link from "next/link";
import { materializeExternalTitleAction } from "@/app/explore/actions";
import { saveDiscoveredTitleAction } from "@/app/discovery/actions";
import { getDiscoveryShelf } from "@/lib/discovery/service";
import {
  parseDiscoveryPage,
  parseDiscoverySort,
  shelfFor,
  SORTS_BY_KIND,
  DISCOVERY_SHELVES,
} from "@/lib/discovery/shelves";
import type { MediaKind } from "@/lib/types";
import { cn } from "@/lib/cn";
import { getSaveListOptions } from "./save-list-options";
import { DiscoveryShelf } from "./discovery-shelf";

interface DiscoveryBrowseProps {
  kind: MediaKind;
  rawSort?: string;
  rawPage?: string;
}

function browseHref(kind: MediaKind, sort: string, page: number): string {
  const params = new URLSearchParams({ type: kind, discover: sort });
  if (page > 1) params.set("dpage", String(page));
  return `/explore?${params.toString()}#discover`;
}

/**
 * Paged provider discovery for one media type on Explore. The sort tabs and
 * pagination are plain links (shareable, no client state); every page is read
 * through the shared discovery cache and is bounded by the shelf's page cap.
 */
export async function DiscoveryBrowse({
  kind,
  rawSort,
  rawPage,
}: DiscoveryBrowseProps) {
  const sort = parseDiscoverySort(kind, rawSort);
  const def = shelfFor(kind, sort);
  if (!def) return null;
  const page = parseDiscoveryPage(rawPage, def);

  const [result, lists] = await Promise.all([
    getDiscoveryShelf(def.id, page),
    getSaveListOptions(),
  ]);
  if (result.status === "unavailable" && result.reason === "disabled")
    return null;

  const returnTo = browseHref(kind, sort, page).replace("#discover", "");
  const sorts = SORTS_BY_KIND[kind];

  return (
    <div
      id="discover"
      className="flex scroll-mt-24 flex-col gap-6 border-t border-border/60 pt-10"
    >
      {sorts.length > 1 && (
        <nav aria-label="Discovery order">
          <ul role="list" className="flex flex-wrap gap-2">
            {sorts.map((option) => {
              const optionDef = shelfFor(kind, option);
              if (!optionDef) return null;
              const current = option === sort;
              return (
                <li key={option}>
                  <Link
                    href={browseHref(kind, option, 1)}
                    aria-current={current ? "page" : undefined}
                    className={cn(
                      "inline-flex h-8 items-center rounded-lg border px-3 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent",
                      current
                        ? "border-accent/60 bg-accent/10 text-foreground"
                        : "border-border/70 text-foreground/70 hover:text-foreground",
                    )}
                  >
                    {optionDef.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      )}

      {result.status === "ok" ? (
        <>
          <DiscoveryShelf
            id={def.id}
            title={`Discover · ${def.label}`}
            description={def.description}
            candidates={result.page.candidates}
            showDate={sort === "upcoming" || sort === "recent"}
            lists={lists}
            returnTo={returnTo}
            openAction={materializeExternalTitleAction}
            saveAction={saveDiscoveredTitleAction}
          />
          {result.page.candidates.length === 0 && (
            <p className="text-sm text-foreground/60">
              Nothing to show here right now.
            </p>
          )}
          <nav
            aria-label="Discovery pages"
            className="flex items-center justify-between gap-4 text-sm"
          >
            {page > 1 ? (
              <Link
                href={browseHref(kind, sort, page - 1)}
                className="text-accent underline-offset-2 hover:underline"
              >
                Previous page
              </Link>
            ) : (
              <span />
            )}
            <span className="text-foreground/50">Page {page}</span>
            {result.page.hasMore && page < def.maxPages ? (
              <Link
                href={browseHref(kind, sort, page + 1)}
                className="text-accent underline-offset-2 hover:underline"
              >
                Next page
              </Link>
            ) : (
              <span />
            )}
          </nav>
        </>
      ) : (
        <p role="status" className="text-sm leading-relaxed text-foreground/60">
          {DISCOVERY_SHELVES[def.id].label} from this source is unavailable
          right now. Try again shortly.
        </p>
      )}
    </div>
  );
}
