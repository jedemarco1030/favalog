"use client";

import { useActionState, useEffect, useId, useRef } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import {
  initialListItemFormState,
  type ListItemFormState,
} from "@/app/lists/list-form";
import { SubmitButton } from "@/components/auth/submit-button";
import type { ListItemAction } from "./add-to-list-dialog";
import { cn } from "@/lib/cn";

interface RemoveListItemDialogProps {
  open: boolean;
  onClose: () => void;
  /** The list to remove from (ownership re-derived server-side). */
  listId: string;
  listTitle: string;
  /** The trusted title being removed. */
  mediaSlug: string;
  mediaTitle: string;
  /** Safe, same-origin `returnTo` for the auth / onboarding cases. */
  returnTo: string;
  /** The remove-item Server Action, injected (never imported here). */
  action: ListItemAction;
}

/**
 * Accessible, two-step confirmation for removing a title from a real list.
 *
 * Only an owner ever sees the trigger. Opening this alert dialog never removes;
 * the person must confirm the clearly-named destructive action. The dialog
 * names BOTH the title and the list, cannot be dismissed while the removal is
 * committing, disables the button to prevent a repeat submission, and announces
 * progress/failure via live regions. On success it refreshes the route so the
 * list and its compacted positions re-render.
 */
export function RemoveListItemDialog({
  open,
  onClose,
  listId,
  listTitle,
  mediaSlug,
  mediaTitle,
  returnTo,
  action,
}: RemoveListItemDialogProps) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);

  const [state, formAction, isPending] = useActionState<
    ListItemFormState,
    FormData
  >(action, initialListItemFormState);

  const ids = useId();
  const titleId = `${ids}-title`;
  const descId = `${ids}-desc`;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  useEffect(() => {
    if (state.status === "success") {
      router.refresh();
      onClose();
    } else if (
      (state.status === "unauthenticated" || state.status === "onboarding") &&
      state.redirectTo
    ) {
      router.push(state.redirectTo);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const handleCancel = (event: React.SyntheticEvent<HTMLDialogElement>) => {
    if (isPending) event.preventDefault();
  };

  const bannerError =
    state.status === "error" || state.status === "unavailable"
      ? state.message
      : undefined;

  return (
    <dialog
      ref={dialogRef}
      role="alertdialog"
      aria-labelledby={titleId}
      aria-describedby={descId}
      onClose={onClose}
      onCancel={handleCancel}
      className={cn(
        "m-auto w-[min(28rem,calc(100vw-2rem))] rounded-2xl border border-border/70 bg-surface-1 p-0 text-foreground backdrop:bg-black/60",
      )}
    >
      <form action={formAction} className="flex flex-col gap-5 p-5 sm:p-6">
        <input type="hidden" name="listId" value={listId} />
        <input type="hidden" name="mediaSlug" value={mediaSlug} />
        <input type="hidden" name="returnTo" value={returnTo} />

        <div className="flex items-start gap-3">
          <span
            aria-hidden="true"
            className="mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-red-500/15 text-red-300"
          >
            <AlertTriangle className="size-5" />
          </span>
          <div className="min-w-0">
            <h2
              id={titleId}
              className="font-display text-lg leading-tight text-foreground"
            >
              Remove this title?
            </h2>
            <p id={descId} className="mt-1 text-sm text-foreground/70">
              This removes{" "}
              <span className="font-medium text-foreground">
                &ldquo;{mediaTitle}&rdquo;
              </span>{" "}
              from{" "}
              <span className="font-medium text-foreground">
                &ldquo;{listTitle}&rdquo;
              </span>
              . The list&rsquo;s order updates automatically.
            </p>
          </div>
        </div>

        {bannerError && (
          <p
            role="alert"
            className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200"
          >
            {bannerError}
          </p>
        )}

        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="inline-flex h-10 items-center rounded-lg border border-border/70 bg-surface-1 px-4 text-sm text-foreground outline-none transition-colors hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50"
          >
            Cancel
          </button>
          <SubmitButton
            pendingLabel="Removing…"
            className="bg-red-600 text-white hover:bg-red-500"
          >
            Remove title
          </SubmitButton>
        </div>

        <p role="status" aria-live="polite" className="sr-only">
          {isPending ? "Removing the title…" : ""}
        </p>
      </form>
    </dialog>
  );
}
