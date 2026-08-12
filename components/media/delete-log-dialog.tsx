"use client";

import { useActionState, useEffect, useId, useRef } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import {
  initialDeleteFormState,
  type DeleteFormState,
} from "@/app/diary/diary-form";
import { SubmitButton } from "@/components/auth/submit-button";
import { cn } from "@/lib/cn";

/** The `useActionState`-compatible action the delete dialog submits to. */
export type DeleteDialogAction = (
  state: DeleteFormState,
  formData: FormData,
) => Promise<DeleteFormState> | DeleteFormState;

interface DeleteLogDialogProps {
  open: boolean;
  onClose: () => void;
  /** The diary entry to delete (rendered as a hidden field). */
  diaryEntryId: string;
  /** Title being deleted — named in the confirmation copy. */
  title: string;
  /** ISO timestamp of the entry's logged date — shown to disambiguate. */
  loggedAt?: string;
  /** Safe, same-origin path used as the sign-in `returnTo`. */
  returnTo: string;
  /** The action to submit to (injected so stories/tests need no server import). */
  action: DeleteDialogAction;
}

const dateFormatter = new Intl.DateTimeFormat("en", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

/**
 * Accessible, destructive-confirmation dialog for deleting a diary entry.
 *
 * Built on the native `<dialog>` element (as an alert dialog) so focus
 * trapping, Escape-to-close, and focus return to the invoking control come for
 * free. Deletion is deliberately a TWO-STEP action: opening this dialog never
 * deletes; the person must click the clearly-destructive "Delete entry" button.
 * The dialog cannot be dismissed while the delete is committing, disables the
 * button to prevent a repeat submission, and announces progress/failure via
 * live regions. On success it refreshes the route (so the diary, title personal
 * state, and profile reflect the removal) and closes.
 */
export function DeleteLogDialog({
  open,
  onClose,
  diaryEntryId,
  title,
  loggedAt,
  returnTo,
  action,
}: DeleteLogDialogProps) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);

  const [state, formAction, isPending] = useActionState<
    DeleteFormState,
    FormData
  >(action, initialDeleteFormState);

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
    } else if (state.status === "unauthenticated" && state.redirectTo) {
      router.push(state.redirectTo);
    }
    // Only react to a new action result.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const handleCancel = (event: React.SyntheticEvent<HTMLDialogElement>) => {
    // Don't allow Escape/backdrop dismissal while the delete is committing.
    if (isPending) event.preventDefault();
  };

  const bannerError =
    state.status === "error" || state.status === "unavailable"
      ? state.message
      : undefined;

  const loggedLabel =
    loggedAt && !Number.isNaN(new Date(loggedAt).getTime())
      ? dateFormatter.format(new Date(loggedAt))
      : null;

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
        <input type="hidden" name="diaryEntryId" value={diaryEntryId} />
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
              Delete this diary entry?
            </h2>
            <p id={descId} className="mt-1 text-sm text-foreground/70">
              This permanently removes your log of{" "}
              <span className="font-medium text-foreground">
                &ldquo;{title}&rdquo;
              </span>
              {loggedLabel ? (
                <>
                  {" "}
                  from{" "}
                  <time dateTime={loggedAt} className="text-foreground">
                    {loggedLabel}
                  </time>
                </>
              ) : null}
              , along with any review on it. This can&rsquo;t be undone.
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
            pendingLabel="Deleting…"
            className="bg-red-600 text-white hover:bg-red-500"
          >
            Delete entry
          </SubmitButton>
        </div>

        {/* Assistive-tech announcement for the deleting state. */}
        <p role="status" aria-live="polite" className="sr-only">
          {isPending ? "Deleting your entry…" : ""}
        </p>
      </form>
    </dialog>
  );
}
