"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Heart, Loader2 } from "lucide-react";
import {
  initialFavoriteFormState,
  type FavoriteFormState,
} from "@/app/title/[slug]/favorite-form";
import { cn } from "@/lib/cn";

/** The set-favorite Server Action signature, injected (never imported here). */
export type FavoriteAction = (
  state: FavoriteFormState,
  formData: FormData,
) => Promise<FavoriteFormState>;

interface FavoriteButtonProps {
  /** Trusted catalog slug; ownership + identity resolved server-side. */
  mediaSlug: string;
  /** For the accessible name only. */
  mediaTitle: string;
  /** Safe, same-origin `returnTo` (this title route) for the auth cases. */
  returnTo: string;
  /**
   * The viewer's persisted favorite state, loaded on the server. The control
   * renders the server truth — the derived displayed state only ever comes from
   * this prop or the ACTUAL server-returned result, never an optimistic guess.
   */
  initialIsFavorite: boolean;
  /** The set-favorite Server Action, injected. */
  action: FavoriteAction;
  /**
   * False when the catalog slug can't be resolved to the persistent store. The
   * control then renders disabled with a controlled explanatory message rather
   * than letting a doomed write proceed.
   */
  available?: boolean;
  className?: string;
}

/**
 * An accessible Favorite / Favorited toggle for a signed-in, onboarded viewer.
 *
 * Presentational and action-injected: the set-favorite Server Action is passed
 * in, so Storybook can render every state without importing a `"use server"`
 * module. It submits a single trusted media slug plus the DESIRED next boolean
 * state; there is no browser Supabase call, `localStorage`, or `getSession`.
 *
 * The displayed pressed state is the server truth: it comes from
 * `initialIsFavorite` until an action succeeds, then from the ACTUAL
 * `state.isFavorite` the server returned — never an optimistic value that could
 * contradict the write. While pending the button is disabled (no duplicate
 * submissions) and shows a spinner; an expired session routes through the safe
 * sign-in flow; a write failure or unavailable catalog surfaces a controlled
 * message.
 */
export function FavoriteButton({
  mediaSlug,
  mediaTitle,
  returnTo,
  initialIsFavorite,
  action,
  available = true,
  className,
}: FavoriteButtonProps) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState<
    FavoriteFormState,
    FormData
  >(action, initialFavoriteFormState);

  useEffect(() => {
    if (
      (state.status === "unauthenticated" || state.status === "onboarding") &&
      state.redirectTo
    ) {
      router.push(state.redirectTo);
    }
  }, [state, router]);

  // Server truth only: the last successful result wins, otherwise the
  // server-loaded initial state.
  const favorited =
    state.status === "success" && typeof state.isFavorite === "boolean"
      ? state.isFavorite
      : initialIsFavorite;

  // The desired next state submitted on click is always the opposite of what
  // is currently shown.
  const desiredNext = String(!favorited);

  const bannerError =
    state.status === "error" || state.status === "unavailable"
      ? state.message
      : !available
        ? "Favoriting isn't available for this title right now."
        : undefined;

  const label = favorited ? "Favorited" : "Favorite";
  const accessibleName = favorited
    ? `Remove ${mediaTitle} from your favorites`
    : `Add ${mediaTitle} to your favorites`;

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <form action={formAction}>
        <input type="hidden" name="mediaSlug" value={mediaSlug} />
        <input type="hidden" name="isFavorite" value={desiredNext} />
        <input type="hidden" name="returnTo" value={returnTo} />

        <button
          type="submit"
          aria-pressed={favorited}
          aria-label={accessibleName}
          disabled={isPending || !available}
          className={cn(
            "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent",
            favorited
              ? "border-accent/40 bg-accent/10 text-accent hover:bg-accent/15"
              : "border-border/70 bg-surface-1 text-foreground/80 hover:border-border hover:text-foreground",
            (isPending || !available) &&
              "cursor-not-allowed opacity-60 hover:border-border/70",
          )}
        >
          {isPending ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <Heart
              className={cn("size-4", favorited && "fill-current")}
              aria-hidden="true"
            />
          )}
          <span>{label}</span>
        </button>
      </form>

      {bannerError && (
        <p role="alert" className="text-sm text-red-300">
          {bannerError}
        </p>
      )}

      <p role="status" aria-live="polite" className="sr-only">
        {isPending
          ? "Updating your favorites…"
          : state.status === "success"
            ? favorited
              ? `Added ${mediaTitle} to your favorites.`
              : `Removed ${mediaTitle} from your favorites.`
            : ""}
      </p>
    </div>
  );
}
