"use client";

import { useActionState, useEffect, useId } from "react";
import { useRouter } from "next/navigation";
import {
  initialEditListFormState,
  type EditListFormState,
} from "@/app/lists/list-form";
import { SubmitButton } from "@/components/auth/submit-button";
import type { ListCreateVisibility } from "@/lib/types";
import { cn } from "@/lib/cn";

/** The `useActionState`-compatible action the edit form submits to. */
export type EditListAction = (
  state: EditListFormState,
  formData: FormData,
) => Promise<EditListFormState> | EditListFormState;

/** The list's current, editable metadata used to pre-fill the form. */
export interface EditListInitialValues {
  /** The list to edit; ownership is re-derived server-side. */
  listId: string;
  title: string;
  description: string | null;
  isRanked: boolean;
  /** Reconciled to a creatable value; `followers` prefills as `private`. */
  visibility: ListCreateVisibility;
}

interface EditListFormProps {
  /**
   * The edit-list Server Action, injected rather than imported so this
   * presentational form never pulls a `"use server"` module — stories/tests
   * drive it directly.
   */
  action: EditListAction;
  /** The list's current metadata, used to pre-fill every field. */
  initial: EditListInitialValues;
  /** Safe, same-origin path used as the sign-in / onboarding `returnTo`. */
  returnTo: string;
  /** Called once when the action reports success (parent handles nav / UI). */
  onSaved?: (state: EditListFormState) => void;
  /** Optional secondary action (e.g. dialog close). */
  onCancel?: () => void;
  cancelLabel?: string;
  submitLabel?: string;
  className?: string;
}

/**
 * Reusable, accessible edit-list form driven by `useActionState`, pre-filled
 * with the list's current metadata.
 *
 * All authoritative validation and persistence happen server-side; this form
 * only renders the fields, field-level and form-level errors, and the
 * pending/success announcements. It never constructs an ownership value, a
 * username, or the canonical slug (which is immutable server-side) — only the
 * list id lookup key and the safe `returnTo`. On the auth/onboarding outcomes it
 * navigates through the server-built safe path; on success it defers to
 * {@link onSaved} so the dialog can refresh the canonical list route.
 */
export function EditListForm({
  action,
  initial,
  returnTo,
  onSaved,
  onCancel,
  cancelLabel = "Cancel",
  submitLabel = "Save changes",
  className,
}: EditListFormProps) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState<
    EditListFormState,
    FormData
  >(action, initialEditListFormState);

  const ids = useId();
  const titleId = `${ids}-title`;
  const titleErrId = `${ids}-title-err`;
  const descId = `${ids}-desc`;
  const descErrId = `${ids}-desc-err`;
  const visErrId = `${ids}-vis-err`;

  useEffect(() => {
    if (state.status === "success") {
      onSaved?.(state);
    } else if (
      (state.status === "unauthenticated" || state.status === "onboarding") &&
      state.redirectTo
    ) {
      router.push(state.redirectTo);
    }
    // Only react to a new action result.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const fieldErrors =
    state.status === "invalid" ? state.fieldErrors : undefined;
  const bannerError =
    state.status === "error" ||
    state.status === "unavailable" ||
    state.status === "invalid"
      ? state.message
      : undefined;

  return (
    <form action={formAction} className={cn("flex flex-col gap-4", className)}>
      <input type="hidden" name="listId" value={initial.listId} />
      <input type="hidden" name="returnTo" value={returnTo} />

      {bannerError && (
        <p
          role="alert"
          className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200"
        >
          {bannerError}
        </p>
      )}

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor={titleId}
          className="text-sm font-medium text-foreground/80"
        >
          List title
        </label>
        <input
          id={titleId}
          type="text"
          name="title"
          required
          maxLength={150}
          defaultValue={initial.title}
          disabled={isPending}
          aria-invalid={fieldErrors?.title ? true : undefined}
          aria-describedby={fieldErrors?.title ? titleErrId : undefined}
          className={cn(
            "w-full rounded-lg border bg-surface-2 px-3 py-2 text-sm text-foreground outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-60",
            fieldErrors?.title ? "border-red-500/60" : "border-border/70",
          )}
        />
        {fieldErrors?.title && (
          <p id={titleErrId} className="text-xs text-red-300">
            {fieldErrors.title}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor={descId}
          className="text-sm font-medium text-foreground/80"
        >
          Description <span className="text-foreground/50">(optional)</span>
        </label>
        <textarea
          id={descId}
          name="description"
          rows={3}
          maxLength={2000}
          defaultValue={initial.description ?? ""}
          disabled={isPending}
          aria-invalid={fieldErrors?.description ? true : undefined}
          aria-describedby={fieldErrors?.description ? descErrId : undefined}
          className={cn(
            "w-full resize-y rounded-lg border bg-surface-2 px-3 py-2 text-sm text-foreground outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-60",
            fieldErrors?.description ? "border-red-500/60" : "border-border/70",
          )}
        />
        {fieldErrors?.description && (
          <p id={descErrId} className="text-xs text-red-300">
            {fieldErrors.description}
          </p>
        )}
      </div>

      <label className="inline-flex items-center gap-2 text-sm text-foreground/80">
        <input
          type="checkbox"
          name="isRanked"
          defaultChecked={initial.isRanked}
          disabled={isPending}
          className="size-4 rounded border-border/70 bg-surface-2 text-accent focus-visible:ring-2 focus-visible:ring-accent"
        />
        Ranked list{" "}
        <span className="text-foreground/50">(order is a ranking)</span>
      </label>

      <fieldset
        className="flex flex-col gap-2"
        aria-describedby={fieldErrors?.visibility ? visErrId : undefined}
      >
        <legend className="text-sm font-medium text-foreground/80">
          Visibility
        </legend>
        <label className="flex items-start gap-2 text-sm text-foreground/80">
          <input
            type="radio"
            name="visibility"
            value="public"
            defaultChecked={initial.visibility === "public"}
            disabled={isPending}
            className="mt-0.5 size-4 border-border/70 bg-surface-2 text-accent focus-visible:ring-2 focus-visible:ring-accent"
          />
          <span>
            Public
            <span className="block text-xs text-foreground/50">
              Anyone can view it.
            </span>
          </span>
        </label>
        <label className="flex items-start gap-2 text-sm text-foreground/80">
          <input
            type="radio"
            name="visibility"
            value="private"
            defaultChecked={initial.visibility === "private"}
            disabled={isPending}
            className="mt-0.5 size-4 border-border/70 bg-surface-2 text-accent focus-visible:ring-2 focus-visible:ring-accent"
          />
          <span>
            Private
            <span className="block text-xs text-foreground/50">
              Only you can view it.
            </span>
          </span>
        </label>
        {fieldErrors?.visibility && (
          <p id={visErrId} className="text-xs text-red-300">
            {fieldErrors.visibility}
          </p>
        )}
      </fieldset>

      <div className="flex items-center justify-end gap-3 pt-1">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={isPending}
            className="inline-flex h-10 items-center rounded-lg border border-border/70 bg-surface-1 px-4 text-sm text-foreground outline-none transition-colors hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50"
          >
            {cancelLabel}
          </button>
        )}
        <SubmitButton pendingLabel="Saving…">{submitLabel}</SubmitButton>
      </div>

      <p role="status" aria-live="polite" className="sr-only">
        {isPending ? "Saving your changes…" : ""}
      </p>
    </form>
  );
}
