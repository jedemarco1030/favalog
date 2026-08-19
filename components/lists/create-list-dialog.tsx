"use client";

import { useEffect, useId, useRef } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import type { CreateListFormState } from "@/app/lists/list-form";
import { CreateListForm, type CreateListAction } from "./create-list-form";
import { cn } from "@/lib/cn";

interface CreateListDialogProps {
  open: boolean;
  onClose: () => void;
  /** The create-list Server Action, injected (never imported here). */
  action: CreateListAction;
  /** Safe, same-origin `returnTo` for the auth / onboarding cases. */
  returnTo: string;
}

/**
 * Accessible create-list dialog for `/lists`.
 *
 * Built on the native `<dialog>` element so focus trapping, Escape-to-close,
 * and focus return to the invoking "Create list" control come for free. It
 * delegates the fields and validation to the shared {@link CreateListForm};
 * on success it navigates to the server-returned canonical `/list/[slug]` so
 * the person lands on their new (empty) real list.
 */
export function CreateListDialog({
  open,
  onClose,
  action,
  returnTo,
}: CreateListDialogProps) {
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

  const handleCreated = (state: CreateListFormState) => {
    if (state.slug) {
      router.push(`/list/${state.slug}`);
    } else {
      router.refresh();
    }
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
              Create a list
            </h2>
            <p id={descId} className="mt-1 text-sm text-foreground/60">
              Start a new cross-media collection. You can add titles from any
              title page.
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

        <CreateListForm
          action={action}
          returnTo={returnTo}
          onCreated={handleCreated}
          onCancel={onClose}
        />
      </div>
    </dialog>
  );
}
