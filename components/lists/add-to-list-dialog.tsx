"use client";

import { useActionState, useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useFormStatus } from "react-dom";
import { Check, Globe, ListOrdered, Lock, Plus, X } from "lucide-react";
import {
  initialListItemFormState,
  type CreateListFormState,
  type ListItemFormState,
} from "@/app/lists/list-form";
import type { ListMembershipView } from "@/lib/supabase/list-view-model";
import { itemCountLabel } from "@/components/lists/list-view";
import { visibilityLabel } from "@/components/lists/real-list-format";
import { CreateListForm, type CreateListAction } from "./create-list-form";
import { cn } from "@/lib/cn";

/** The `useActionState`-compatible add/remove action. */
export type ListItemAction = (
  state: ListItemFormState,
  formData: FormData,
) => Promise<ListItemFormState> | ListItemFormState;

interface AddToListDialogProps {
  open: boolean;
  onClose: () => void;
  /** The trusted title being added/removed. Only slug + title are used. */
  media: { slug: string; title: string };
  /** Safe, same-origin `returnTo` for the auth / onboarding cases. */
  returnTo: string;
  /** The viewer's own lists + whether each already contains this title. */
  lists: ListMembershipView[];
  /**
   * False when the catalog slug is unknown to the persistent store: the dialog
   * then shows a controlled unavailable state rather than pretending a write
   * would work.
   */
  mediaKnown: boolean;
  /**
   * A safe, human-readable message when the viewer's lists couldn't be read.
   * When present the dialog shows a controlled read-error state instead of
   * toggles, rather than pretending a write would succeed.
   */
  error?: string | null;
  addAction: ListItemAction;
  removeAction: ListItemAction;
  createAction: CreateListAction;
}

/**
 * Accessible "Add to list" dialog for a signed-in, onboarded viewer.
 *
 * Built on the native `<dialog>` element for focus trapping, Escape-to-close,
 * and focus return to the invoking control. It lists every owned list with its
 * status and whether the title is already a member, and lets the viewer toggle
 * membership through the idempotent add/remove Server Actions (injected, never
 * imported here). Successful changes update the in-dialog state immediately so
 * nothing goes stale, and a link to the affected list is offered. When the
 * viewer has no lists (or chooses to), an inline create form creates the list
 * and adds this title atomically, then folds the new list into the view.
 */
export function AddToListDialog({
  open,
  onClose,
  media,
  returnTo,
  lists: initialLists,
  mediaKnown,
  error,
  addAction,
  removeAction,
  createAction,
}: AddToListDialogProps) {
  const blocked = Boolean(error) || !mediaKnown;
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const ids = useId();
  const titleId = `${ids}-title`;
  const descId = `${ids}-desc`;

  const [lists, setLists] = useState<ListMembershipView[]>(initialLists);
  const [mode, setMode] = useState<"list" | "create">(
    initialLists.length === 0 ? "create" : "list",
  );
  const [pendingCount, setPendingCount] = useState(0);
  const [notice, setNotice] = useState<{
    message: string;
    slug: string;
    listTitle: string;
  } | null>(null);

  // Local state is seeded from props on mount. The parent remounts this dialog
  // (via a changing `key`) each time it is opened, so a reopen always starts
  // from the latest server-provided snapshot without a set-state-in-effect.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  const isBusy = pendingCount > 0;

  const handleCancel = (event: React.SyntheticEvent<HTMLDialogElement>) => {
    // Don't allow Escape/backdrop dismissal while a change is committing.
    if (isBusy) event.preventDefault();
  };

  const setPending = (delta: number) =>
    setPendingCount((count) => Math.max(0, count + delta));

  const handleToggled = (
    listId: string,
    contains: boolean,
    listTitle: string,
    slug: string,
  ) => {
    setLists((current) =>
      current.map((list) =>
        list.id === listId
          ? {
              ...list,
              containsMedia: contains,
              itemCount: Math.max(0, list.itemCount + (contains ? 1 : -1)),
            }
          : list,
      ),
    );
    setNotice({
      message: contains
        ? `Added to ${listTitle}.`
        : `Removed from ${listTitle}.`,
      slug,
      listTitle,
    });
    router.refresh();
  };

  const handleCreated = (state: CreateListFormState) => {
    if (!state.slug || !state.listId) return;
    const added = state.addedMediaSlug === media.slug;
    const view: ListMembershipView = {
      id: state.listId,
      slug: state.slug,
      title: state.title ?? "New list",
      description: null,
      visibility: state.visibility ?? "public",
      isRanked: state.isRanked ?? false,
      itemCount: added ? 1 : 0,
      updatedAt: new Date().toISOString(),
      containsMedia: added,
    };
    setLists((current) => [view, ...current.filter((l) => l.id !== view.id)]);
    setMode("list");
    setNotice({
      message: `Created ${view.title}${added ? ` and added ${media.title}` : ""}.`,
      slug: view.slug,
      listTitle: view.title,
    });
    router.refresh();
  };

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      aria-describedby={descId}
      onClose={onClose}
      onCancel={handleCancel}
      className={cn(
        "m-auto w-[min(32rem,calc(100vw-2rem))] rounded-2xl border border-border/70 bg-surface-1 p-0 text-foreground backdrop:bg-black/60",
      )}
    >
      <div className="flex flex-col gap-5 p-5 sm:p-6">
        <header className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2
              id={titleId}
              className="font-display text-xl leading-tight text-foreground"
            >
              Add &ldquo;{media.title}&rdquo; to a list
            </h2>
            <p id={descId} className="mt-1 text-sm text-foreground/60">
              {error
                ? error
                : mediaKnown
                  ? "Choose one of your lists, or create a new one."
                  : "This title isn't available to add to lists right now."}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isBusy}
            aria-label="Close"
            className="shrink-0 rounded-full p-1.5 text-foreground/60 outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50"
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </header>

        {notice && (
          <p
            role="status"
            className="flex flex-wrap items-center gap-x-2 rounded-lg border border-accent/30 bg-accent/10 px-3 py-2 text-sm text-foreground/80"
          >
            <span>{notice.message}</span>
            <a
              href={`/list/${notice.slug}`}
              className="font-medium text-accent underline-offset-2 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-accent"
            >
              View list
            </a>
          </p>
        )}

        {blocked ? (
          <div className="flex items-center justify-end">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-10 items-center rounded-lg border border-border/70 bg-surface-1 px-4 text-sm text-foreground outline-none transition-colors hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-accent"
            >
              Close
            </button>
          </div>
        ) : mode === "create" ? (
          <div className="flex flex-col gap-3">
            <h3 className="text-sm font-medium text-foreground/80">New list</h3>
            <CreateListForm
              action={createAction}
              returnTo={returnTo}
              mediaSlug={media.slug}
              onCreated={handleCreated}
              onCancel={lists.length > 0 ? () => setMode("list") : undefined}
              cancelLabel="Back"
              submitLabel="Create & add"
            />
          </div>
        ) : lists.length === 0 ? (
          <EmptyLists onCreate={() => setMode("create")} />
        ) : (
          <div className="flex flex-col gap-3">
            <ul className="flex max-h-80 flex-col gap-2 overflow-y-auto">
              {lists.map((list) => (
                <li key={list.id}>
                  <MembershipRow
                    list={list}
                    media={media}
                    returnTo={returnTo}
                    addAction={addAction}
                    removeAction={removeAction}
                    onToggled={handleToggled}
                    onPendingChange={setPending}
                  />
                </li>
              ))}
            </ul>
            <div className="flex justify-start pt-1">
              <button
                type="button"
                onClick={() => setMode("create")}
                className="inline-flex items-center gap-2 rounded-lg border border-border/70 bg-surface-1 px-3 py-2 text-sm text-foreground outline-none transition-colors hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-accent"
              >
                <Plus className="size-4" aria-hidden="true" />
                New list
              </button>
            </div>
          </div>
        )}
      </div>
    </dialog>
  );
}

/** Honest empty state with an inline create option. */
function EmptyLists({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-lg border border-border/60 bg-surface-2/40 px-4 py-5">
      <p className="text-sm text-foreground/70">
        You haven&rsquo;t created any lists yet. Create one to start collecting
        titles.
      </p>
      <button
        type="button"
        onClick={onCreate}
        className="inline-flex items-center gap-2 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-accent-foreground outline-none transition-colors hover:bg-accent-strong focus-visible:ring-2 focus-visible:ring-accent"
      >
        <Plus className="size-4" aria-hidden="true" />
        Create list
      </button>
    </div>
  );
}

interface MembershipRowProps {
  list: ListMembershipView;
  media: { slug: string; title: string };
  returnTo: string;
  addAction: ListItemAction;
  removeAction: ListItemAction;
  onToggled: (
    listId: string,
    contains: boolean,
    listTitle: string,
    slug: string,
  ) => void;
  onPendingChange: (delta: number) => void;
}

/**
 * One toggle row: the list's status plus a single submit control that adds the
 * title when absent and removes it when present. Exactly one interactive
 * control per row (no nested buttons), with a specific accessible name such as
 * "Add Afterglow to Favorite Sci-Fi" / "Remove Afterglow from Favorite Sci-Fi".
 */
function MembershipRow({
  list,
  media,
  returnTo,
  addAction,
  removeAction,
  onToggled,
  onPendingChange,
}: MembershipRowProps) {
  const router = useRouter();
  const contains = list.containsMedia;
  // Bind whichever action matches the current membership; React uses the latest.
  const [state, formAction, isPending] = useActionState<
    ListItemFormState,
    FormData
  >(contains ? removeAction : addAction, initialListItemFormState);

  // Bubble pending state up so the dialog can block close/duplicate submits.
  useEffect(() => {
    onPendingChange(isPending ? 1 : -1);
    return () => {
      if (isPending) onPendingChange(-1);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPending]);

  useEffect(() => {
    if (state.status === "success" && state.action) {
      onToggled(
        list.id,
        state.action === "added",
        list.title,
        state.slug ?? list.slug,
      );
    } else if (
      (state.status === "unauthenticated" || state.status === "onboarding") &&
      state.redirectTo
    ) {
      router.push(state.redirectTo);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const rowError =
    state.status === "error" || state.status === "unavailable"
      ? state.message
      : undefined;

  const isPrivate = list.visibility !== "public";

  return (
    <form
      action={formAction}
      className="rounded-lg border border-border/60 bg-surface-2/40 p-3"
    >
      <input type="hidden" name="listId" value={list.id} />
      <input type="hidden" name="mediaSlug" value={media.slug} />
      <input type="hidden" name="returnTo" value={returnTo} />

      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-foreground">{list.title}</p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-foreground/50">
            <span className="tabular-nums">
              {itemCountLabel(list.itemCount)}
            </span>
            <span aria-hidden="true">·</span>
            <span className="inline-flex items-center gap-1">
              {isPrivate ? (
                <Lock className="size-3" aria-hidden="true" />
              ) : (
                <Globe className="size-3" aria-hidden="true" />
              )}
              {visibilityLabel(list.visibility)}
            </span>
            {list.isRanked && (
              <>
                <span aria-hidden="true">·</span>
                <span className="inline-flex items-center gap-1">
                  <ListOrdered className="size-3" aria-hidden="true" />
                  Ranked
                </span>
              </>
            )}
          </p>
        </div>

        <MembershipToggle
          contains={contains}
          label={
            contains
              ? `Remove ${media.title} from ${list.title}`
              : `Add ${media.title} to ${list.title}`
          }
        />
      </div>

      {rowError && (
        <p role="alert" className="mt-2 text-xs text-red-300">
          {rowError}
        </p>
      )}
    </form>
  );
}

/** The single toggle submit control; reflects pending via `useFormStatus`. */
function MembershipToggle({
  contains,
  label,
}: {
  contains: boolean;
  label: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-disabled={pending}
      aria-pressed={contains}
      aria-label={label}
      className={cn(
        "inline-flex size-9 shrink-0 items-center justify-center rounded-full border outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50",
        contains
          ? "border-accent/50 bg-accent/15 text-accent hover:bg-accent/20"
          : "border-border/70 bg-surface-1 text-foreground/70 hover:border-border hover:text-foreground",
      )}
    >
      {contains ? (
        <Check className="size-4" aria-hidden="true" />
      ) : (
        <Plus className="size-4" aria-hidden="true" />
      )}
    </button>
  );
}
