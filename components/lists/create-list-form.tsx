"use client";

import { useActionState, useEffect, useId } from "react";
import { useRouter } from "next/navigation";
import {
  initialCreateListFormState,
  type CreateListFormState,
} from "@/app/lists/list-form";
import { SubmitButton } from "@/components/auth/submit-button";
import { cn } from "@/lib/cn";

/** The `useActionState`-compatible action the create form submits to. */
export type CreateListAction = (
  state: CreateListFormState,
  formData: FormData,
) => Promise<CreateListFormState> | CreateListFormState;

interface CreateListFormProps {
  /**
   * The create-list Server Action, injected rather than imported so this
   * presentational form never pulls a `"use server"` module — stories/tests
   * drive it directly.
   */
  action: CreateListAction;
  /** Safe, same-origin path used as the sign-in / onboarding `returnTo`. */
  returnTo: string;
  /**
   * Optional trusted catalog slug added atomically on creation (the "create a
   * list from a title" flow). Rendered as a hidden field.
   */
  mediaSlug?: string | null;
  /** Called once when the action reports success (parent handles nav / UI). */
  onCreated?: (state: CreateListFormState) => void;
  /** Optional secondary action (e.g. "Back" to the list view / dialog close). */
  onCancel?: () => void;
  cancelLabel?: string;
  submitLabel?: string;
  /** Disables inputs/submit while a save is committing in the parent. */
  disabled?: boolean;
  className?: string;
}

/**
 * Reusable, accessible create-list form driven by `useActionState`.
 *
 * All authoritative validation and persistence happen server-side; this form
 * only renders the fields, field-level and form-level errors, and the
 * pending/success announcements. It never constructs an ownership value, media
 * UUID, position, username, or canonical slug — only the trusted `mediaSlug`
 * (when creating from a title) and the safe `returnTo`. On the auth/onboarding
 * outcomes it navigates through the server-built safe path; on success it
 * defers to {@link onCreated} so the create dialog can redirect while the
 * add-to-list dialog can fold the new list into its membership view.
 */
export function CreateListForm({
  action,
  returnTo,
  mediaSlug,
  onCreated,
  onCancel,
  cancelLabel = "Cancel",
  submitLabel = "Create list",
  disabled = false,
  className,
}: CreateListFormProps) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState<
    CreateListFormState,
    FormData
  >(action, initialCreateListFormState);

  const ids = useId();
  const titleId = `${ids}-title`;
  const titleErrId = `${ids}-title-err`;
  const descId = `${ids}-desc`;
  const descErrId = `${ids}-desc-err`;
  const visErrId = `${ids}-vis-err`;

  useEffect(() => {
    if (state.status === "success") {
      onCreated?.(state);
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

  const inputBusy = disabled || isPending;

  return (
    <form action={formAction} className={cn("flex flex-col gap-4", className)}>
      {mediaSlug ? (
        <input type="hidden" name="mediaSlug" value={mediaSlug} />
      ) : null}
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
          disabled={inputBusy}
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
          disabled={inputBusy}
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
          disabled={inputBusy}
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
            defaultChecked
            disabled={inputBusy}
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
            disabled={inputBusy}
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
        <SubmitButton pendingLabel="Creating…">{submitLabel}</SubmitButton>
      </div>

      <p role="status" aria-live="polite" className="sr-only">
        {isPending ? "Creating your list…" : ""}
      </p>
    </form>
  );
}
