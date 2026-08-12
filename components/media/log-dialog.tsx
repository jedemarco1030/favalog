"use client";

import { useActionState, useEffect, useId, useRef } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import {
  initialLogFormState,
  type LogFormState,
} from "@/app/title/[slug]/log-form";
import { deriveDiaryAction } from "@/lib/supabase/log-input";
import type { MediaItem } from "@/lib/types";
import { RatingInput } from "./rating-input";
import { SubmitButton } from "@/components/auth/submit-button";
import { cn } from "@/lib/cn";

/** Which field the dialog emphasises when opened, per the triggering action. */
export type LogFocus = "log" | "rate" | "review";

/** The `useActionState`-compatible action the dialog submits to. */
export type LogDialogAction = (
  state: LogFormState,
  formData: FormData,
) => Promise<LogFormState> | LogFormState;

/** Raw values used to pre-fill the dialog when editing an existing entry. */
export interface LogDialogInitialValues {
  /** ISO timestamp of the entry's logged date. */
  loggedAt?: string;
  rating?: number | null;
  isRevisit?: boolean;
  reviewTitle?: string | null;
  reviewBody?: string | null;
  containsSpoilers?: boolean;
}

interface LogDialogProps {
  open: boolean;
  onClose: () => void;
  focus: LogFocus;
  /** The title being logged/edited. Only kind/slug/title are used here. */
  item: Pick<MediaItem, "kind" | "slug" | "title">;
  /** Safe, same-origin path back to this title (used as the sign-in returnTo). */
  returnTo: string;
  /** Default revisit selection — true when the title was already logged. */
  defaultRevisit: boolean;
  /**
   * `"create"` (default) logs a new entry; `"edit"` updates an existing entry
   * and pre-fills from {@link initialValues}.
   */
  mode?: "create" | "edit";
  /**
   * The `useActionState` action to submit to (the create or edit Server
   * Action). Injected rather than imported so this presentational dialog never
   * pulls a server-only module — stories/tests can drive it directly.
   */
  action: LogDialogAction;
  /** The diary entry being edited (rendered as a hidden field in edit mode). */
  diaryEntryId?: string;
  /** Pre-fill values for edit mode. */
  initialValues?: LogDialogInitialValues;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** A local `datetime-local` value string (`YYYY-MM-DDTHH:mm`) for `now`. */
function nowLocalDateTime(): string {
  return toLocalDateTime(new Date());
}

/** Format a Date as a local `datetime-local` value string. */
function toLocalDateTime(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate(),
  )}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Convert a stored ISO timestamp to a local `datetime-local` value. */
function isoToLocalDateTime(iso: string | undefined): string {
  if (!iso) return nowLocalDateTime();
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? nowLocalDateTime()
    : toLocalDateTime(date);
}

/**
 * Accessible logging dialog shared by the Log / Rate / Review actions.
 *
 * Built on the native `<dialog>` element so focus trapping, Escape-to-close,
 * and focus return to the trigger come for free. It submits to the
 * `logTitleAction` Server Action via `useActionState`, so all authoritative
 * validation/persistence happens server-side; this component only renders the
 * fields, the pending/error/success states, and moves focus to the emphasised
 * field for the entry point that opened it.
 *
 * Because there is no standalone rating/review store, saving Rate creates a
 * diary entry and saving Review creates a diary entry with a linked review;
 * the dialog states this explicitly rather than logging silently.
 */
export function LogDialog({
  open,
  onClose,
  focus,
  item,
  returnTo,
  defaultRevisit,
  mode = "create",
  action,
  diaryEntryId,
  initialValues,
}: LogDialogProps) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const ratingRef = useRef<HTMLInputElement>(null);
  const reviewBodyRef = useRef<HTMLTextAreaElement>(null);
  const dateRef = useRef<HTMLInputElement>(null);

  const [state, formAction, isPending] = useActionState<LogFormState, FormData>(
    action,
    initialLogFormState,
  );

  const ids = useId();
  const titleId = `${ids}-title`;
  const descId = `${ids}-desc`;
  const dateErrId = `${ids}-date-err`;
  const ratingErrId = `${ids}-rating-err`;
  const reviewTitleErrId = `${ids}-rtitle-err`;
  const reviewBodyErrId = `${ids}-rbody-err`;

  const isEdit = mode === "edit";
  // In edit mode the revisit default comes from the stored entry; in create
  // mode it reflects whether the title was already logged.
  const revisitDefault = isEdit
    ? Boolean(initialValues?.isRevisit)
    : defaultRevisit;
  const dateDefault = isEdit
    ? isoToLocalDateTime(initialValues?.loggedAt)
    : nowLocalDateTime();

  const verb = deriveDiaryAction(item.kind, revisitDefault);
  const revisitLabel = item.kind === "book" ? "Reread" : "Rewatch";
  const revisitDescription =
    item.kind === "book" ? "I've read this before" : "I've seen this before";

  // Open / close the native dialog in response to the `open` prop.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  // Move focus to the field emphasised by the entry point once opened.
  useEffect(() => {
    if (!open) return;
    const target =
      focus === "rate"
        ? ratingRef.current
        : focus === "review"
          ? reviewBodyRef.current
          : dateRef.current;
    // Defer so the dialog's own initial focus doesn't override ours.
    const raf = requestAnimationFrame(() => target?.focus());
    return () => cancelAnimationFrame(raf);
  }, [open, focus]);

  // React to the action result: refresh + close on success; navigate for the
  // auth / onboarding cases through the server-built safe path.
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
    // Only react to a new action result.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const handleCancel = (event: React.SyntheticEvent<HTMLDialogElement>) => {
    // Don't allow Escape/backdrop dismissal while a save is committing.
    if (isPending) event.preventDefault();
  };

  const fieldErrors =
    state.status === "invalid" ? state.fieldErrors : undefined;
  const bannerError =
    state.status === "error" ||
    state.status === "unavailable" ||
    state.status === "invalid"
      ? state.message
      : undefined;

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
      <form action={formAction} className="flex flex-col gap-5 p-5 sm:p-6">
        {isEdit ? (
          <input type="hidden" name="diaryEntryId" value={diaryEntryId ?? ""} />
        ) : (
          <input type="hidden" name="mediaSlug" value={item.slug} />
        )}
        <input type="hidden" name="returnTo" value={returnTo} />

        <header className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2
              id={titleId}
              className="font-display text-xl leading-tight text-foreground"
            >
              {isEdit ? "Edit log" : "Log"} &ldquo;{item.title}&rdquo;
            </h2>
            <p id={descId} className="mt-1 text-sm text-foreground/60">
              {isEdit
                ? "Update this diary entry. Ratings and reviews live on the entry."
                : "Saving adds a diary entry" +
                  (focus === "review"
                    ? " with your review"
                    : focus === "rate"
                      ? " with your rating"
                      : "") +
                  ". Ratings and reviews live on the entry."}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            aria-label="Close"
            className="shrink-0 rounded-full p-1.5 text-foreground/60 outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50"
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </header>

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
            htmlFor={`${ids}-date`}
            className="text-sm font-medium text-foreground/80"
          >
            When did you {verb.replace(/ed$/, "")} it?
          </label>
          <input
            ref={dateRef}
            id={`${ids}-date`}
            type="datetime-local"
            name="loggedAt"
            defaultValue={dateDefault}
            aria-invalid={fieldErrors?.loggedAt ? true : undefined}
            aria-describedby={fieldErrors?.loggedAt ? dateErrId : undefined}
            className={cn(
              "w-full rounded-lg border bg-surface-2 px-3 py-2 text-sm text-foreground outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent",
              fieldErrors?.loggedAt ? "border-red-500/60" : "border-border/70",
            )}
          />
          {fieldErrors?.loggedAt && (
            <p id={dateErrId} className="text-xs text-red-300">
              {fieldErrors.loggedAt}
            </p>
          )}
        </div>

        <label className="inline-flex items-center gap-2 text-sm text-foreground/80">
          <input
            type="checkbox"
            name="isRevisit"
            defaultChecked={revisitDefault}
            className="size-4 rounded border-border/70 bg-surface-2 text-accent focus-visible:ring-2 focus-visible:ring-accent"
          />
          {revisitLabel}{" "}
          <span className="text-foreground/50">({revisitDescription})</span>
        </label>

        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-medium text-foreground/80">
            Rating <span className="text-foreground/50">(optional)</span>
          </legend>
          <RatingInput
            autoFocusRef={ratingRef}
            defaultValue={initialValues?.rating ?? null}
            invalid={Boolean(fieldErrors?.rating)}
            describedBy={fieldErrors?.rating ? ratingErrId : undefined}
          />
          {fieldErrors?.rating && (
            <p id={ratingErrId} className="text-xs text-red-300">
              {fieldErrors.rating}
            </p>
          )}
        </fieldset>

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor={`${ids}-rtitle`}
            className="text-sm font-medium text-foreground/80"
          >
            Review title <span className="text-foreground/50">(optional)</span>
          </label>
          <input
            id={`${ids}-rtitle`}
            type="text"
            name="reviewTitle"
            defaultValue={initialValues?.reviewTitle ?? ""}
            aria-invalid={fieldErrors?.reviewTitle ? true : undefined}
            aria-describedby={
              fieldErrors?.reviewTitle ? reviewTitleErrId : undefined
            }
            className={cn(
              "w-full rounded-lg border bg-surface-2 px-3 py-2 text-sm text-foreground outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent",
              fieldErrors?.reviewTitle
                ? "border-red-500/60"
                : "border-border/70",
            )}
          />
          {fieldErrors?.reviewTitle && (
            <p id={reviewTitleErrId} className="text-xs text-red-300">
              {fieldErrors.reviewTitle}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor={`${ids}-rbody`}
            className="text-sm font-medium text-foreground/80"
          >
            Review <span className="text-foreground/50">(optional)</span>
          </label>
          <textarea
            ref={reviewBodyRef}
            id={`${ids}-rbody`}
            name="reviewBody"
            rows={4}
            defaultValue={initialValues?.reviewBody ?? ""}
            aria-invalid={fieldErrors?.reviewBody ? true : undefined}
            aria-describedby={
              fieldErrors?.reviewBody ? reviewBodyErrId : undefined
            }
            className={cn(
              "w-full resize-y rounded-lg border bg-surface-2 px-3 py-2 text-sm text-foreground outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent",
              fieldErrors?.reviewBody
                ? "border-red-500/60"
                : "border-border/70",
            )}
          />
          {fieldErrors?.reviewBody && (
            <p id={reviewBodyErrId} className="text-xs text-red-300">
              {fieldErrors.reviewBody}
            </p>
          )}
        </div>

        <label className="inline-flex items-center gap-2 text-sm text-foreground/80">
          <input
            type="checkbox"
            name="containsSpoilers"
            defaultChecked={Boolean(initialValues?.containsSpoilers)}
            className="size-4 rounded border-border/70 bg-surface-2 text-accent focus-visible:ring-2 focus-visible:ring-accent"
          />
          This review contains spoilers
        </label>

        <div className="flex items-center justify-end gap-3 pt-1">
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="inline-flex h-10 items-center rounded-lg border border-border/70 bg-surface-1 px-4 text-sm text-foreground outline-none transition-colors hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50"
          >
            Cancel
          </button>
          <SubmitButton pendingLabel="Saving…">
            {isEdit ? "Save changes" : "Save log"}
          </SubmitButton>
        </div>

        {/* Assistive-tech announcement for the saving state. */}
        <p role="status" aria-live="polite" className="sr-only">
          {isPending
            ? isEdit
              ? "Saving your changes…"
              : "Saving your log…"
            : ""}
        </p>
      </form>
    </dialog>
  );
}
