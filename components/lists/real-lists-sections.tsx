import { AlertTriangle } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { RealListCard } from "@/components/lists/real-list-card";
import { CreateListLauncher } from "@/components/lists/create-list-launcher";
import type { MyListsResult, PublicListsResult } from "@/lib/supabase/lists";

interface RealListsSectionsProps {
  /** The signed-in viewer's own lists, or null when signed out. */
  myLists: MyListsResult | null;
  /** Public lists for the community section. */
  community: PublicListsResult;
  /** Safe, same-origin `returnTo` for the inline create affordance. */
  createReturnTo: string;
  createSignInHref: string;
}

const GRID_CLASS = "grid gap-6 sm:grid-cols-2 lg:grid-cols-3";

/** A controlled, honest read-error note (never a mock fallback). */
function ReadError({ label }: { label: string }) {
  return (
    <p
      role="alert"
      className="flex items-center gap-2 rounded-lg border border-border/60 bg-surface-1 px-4 py-3 text-sm text-foreground/70"
    >
      <AlertTriangle className="size-4 text-foreground/50" aria-hidden="true" />
      {label}
    </p>
  );
}

/**
 * The real (persistent) list sections for `/lists`: the viewer's own lists and
 * the community's public lists, both from serializable view models.
 *
 * These never fall back to mock data on error — a failed read shows an honest
 * error, an empty owner shows an honest empty state with a create option, and
 * private lists are never shown in the community section (server-filtered to
 * public). When persistence is unavailable (no env) the sections simply don't
 * render, leaving the curated mock browsing below intact.
 */
export function RealListsSections({
  myLists,
  community,
  createReturnTo,
  createSignInHref,
}: RealListsSectionsProps) {
  return (
    <div className="flex flex-col gap-12">
      {myLists && myLists.status !== "unavailable" && (
        <section aria-labelledby="your-lists-heading">
          <h2
            id="your-lists-heading"
            className="mb-6 font-display text-2xl tracking-tight text-foreground"
          >
            Your lists
          </h2>
          {myLists.status === "ok" ? (
            myLists.lists.length > 0 ? (
              <ul role="list" className={GRID_CLASS}>
                {myLists.lists.map((list) => (
                  <li key={list.id}>
                    <RealListCard list={list} showVisibility />
                  </li>
                ))}
              </ul>
            ) : (
              <div className="flex flex-col items-start gap-4">
                <EmptyState title="You haven't created any lists yet." />
                <CreateListLauncher
                  variant="signed-in"
                  returnTo={createReturnTo}
                  signInHref={createSignInHref}
                />
              </div>
            )
          ) : (
            <ReadError label="We couldn't load your lists just now. Please try again in a moment." />
          )}
        </section>
      )}

      {community.status !== "unavailable" && (
        <section aria-labelledby="community-lists-heading">
          <h2
            id="community-lists-heading"
            className="mb-1 font-display text-2xl tracking-tight text-foreground"
          >
            Community lists
          </h2>
          <p className="mb-6 text-sm text-foreground/60">
            Public collections from people across Favalog.
          </p>
          {community.status === "ok" ? (
            community.lists.length > 0 ? (
              <ul role="list" className={GRID_CLASS}>
                {community.lists.map((list) => (
                  <li key={list.id}>
                    <RealListCard list={list} owner={list.owner} />
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="No public lists yet." />
            )
          ) : (
            <ReadError label="We couldn't load community lists just now. Please try again in a moment." />
          )}
        </section>
      )}
    </div>
  );
}
