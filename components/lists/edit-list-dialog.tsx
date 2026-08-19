"use client";

import { useEffect, useId, useRef } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import {
  EditListForm,
  type EditListAction,
  type EditListInitialValues,
} from "./edit-list-form";
import { cn } from "@/lib/cn";

interface EditListDialogProps {
  open: boolean;
  onClose: () => void;
  /** The edit-list Server Action, injected (never imported here). */
  action: EditListAction;
  /** The list's current metadata, used to pre-fill the form. */
  initial: EditListInitialValues;
  /** Safe, same-origin `returnTo` for the auth / onboarding cases. */
  returnTo: string;
}

/**
 * Accessible edit-list dialog for the owner of a real `/list/[slug]`.
 *
 * Built on the native `<dialog>` element so focus trapping, Escape-to-close,
 * and focus return to the invoking "Edit list" control come for free. It
 * delegates the pre-filled fields and validation to the shared
 * {@link EditListForm}. Because the list slug is immutable, a successful edit
 * keeps the person on the same canonical `/list/[slug]` URL — the dialog simply
 * refreshes the route so the updated metadata renders, then closes. Dismissal
 * is blocked while a save is committing.
 */
export function EditListDialog({
  open,
  onClose,
  action,
  initial,
  returnTo,
}: EditListDialogProps) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
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

  const handleSaved = () => {
    // The slug is immutable, so we stay on the canonical list URL and just
    // refresh it to render the updated metadata.
    router.refresh();
    onClose();
  };

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      aria-describedby={descId}
      onClose={onClose}
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
              Edit list
            </h2>
            <p id={descId} className="mt-1 text-sm text-foreground/60">
              Update your list&rsquo;s details. Its link stays the same.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 rounded-full p-1.5 text-foreground/60 outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent"
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </header>

        <EditListForm
          action={action}
          initial={initial}
          returnTo={returnTo}
          onSaved={handleSaved}
          onCancel={onClose}
        />
      </div>
    </dialog>
  );
}
