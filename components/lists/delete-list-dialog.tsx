"use client";

import { useActionState, useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import {
  initialDeleteListFormState,
  type DeleteListFormState,
} from "@/app/lists/list-form";
import { SubmitButton } from "@/components/auth/submit-button";
import { cn } from "@/lib/cn";

/** The `useActionState`-compatible delete-list action. */
export type DeleteListAction = (
  state: DeleteListFormState,
  formData: FormData,
) => Promise<DeleteListFormState> | DeleteListFormState;

interface DeleteListDialogProps {
  open: boolean;
  onClose: () => void;
  /** The list to delete (ownership re-derived server-side). */
  listId: string;
  listTitle: string;
  /** Safe, same-origin `returnTo` for the auth / onboarding cases. */
  returnTo: string;
  /** The delete-list Server Action, injected (never imported here). */
  action: DeleteListAction;
}

/**
 * Accessible, deliberate confirmation for deleting an entire real list.
 *
 * Only an owner ever sees the trigger. Opening this alert dialog never deletes;
 * the person must first acknowledge a checkbox that names the list, then confirm
 * the clearly-named destructive action. The dialog explains that every title in
 * the list will be removed, cannot be dismissed while the deletion is
 * committing, disables the button to prevent a repeat submission, and announces
 * progress/failure via live regions. On success it navigates to `/lists` so the
 * person is never left on the now-deleted list page.
 */
export function DeleteListDialog({
  open,
  onClose,
  listId,
  listTitle,
  returnTo,
  action,
}: DeleteListDialogProps) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [confirmed, setConfirmed] = useState(false);

  const [state, formAction, isPending] = useActionState<
    DeleteListFormState,
    FormData
  >(action, initialDeleteListFormState);

  const ids = useId();
  const titleId = `${ids}-title`;
  const descId = `${ids}-desc`;
  const confirmId = `${ids}-confirm`;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      setConfirmed(false);
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  useEffect(() => {
    if (state.status === "success") {
      // Never leave the person on the now-deleted list page.
      router.push("/lists");
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
              Delete this list?
            </h2>
            <p id={descId} className="mt-1 text-sm text-foreground/70">
              This permanently deletes{" "}
              <span className="font-medium text-foreground">
                &ldquo;{listTitle}&rdquo;
              </span>{" "}
              and removes every title from it. This can&rsquo;t be undone.
            </p>
          </div>
        </div>

        <label
          htmlFor={confirmId}
          className="flex items-start gap-2 rounded-lg border border-border/60 bg-surface-2/40 px-3 py-2.5 text-sm text-foreground/80"
        >
          <input
            id={confirmId}
            type="checkbox"
            checked={confirmed}
            onChange={(event) => setConfirmed(event.target.checked)}
            disabled={isPending}
            className="mt-0.5 size-4 rounded border-border/70 bg-surface-2 text-accent focus-visible:ring-2 focus-visible:ring-accent"
          />
          <span>
            Yes, delete{" "}
            <span className="font-medium text-foreground">
              &ldquo;{listTitle}&rdquo;
            </span>{" "}
            and its titles.
          </span>
        </label>

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
            pendingLabel="Deleting…"
            disabled={!confirmed}
            className="bg-red-600 text-white hover:bg-red-500"
          >
            Delete list
          </SubmitButton>
        </div>

        <p role="status" aria-live="polite" className="sr-only">
          {isPending ? "Deleting the list…" : ""}
        </p>
      </form>
    </dialog>
  );
}
