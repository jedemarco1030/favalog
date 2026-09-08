"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Plus } from "lucide-react";
import {
  initialFollowFormState,
  type FollowFormState,
} from "@/app/profile/[username]/follow-form";
import { cn } from "@/lib/cn";

/** The set-follow Server Action signature, injected. */
export type FollowAction = (
  state: FollowFormState,
  formData: FormData,
) => Promise<FollowFormState>;

interface FollowButtonProps {
  /** Target profile canonical username. */
  username: string;
  /** For accessible names. */
  targetDisplayName: string;
  /** Safe, same-origin returnTo path. */
  returnTo: string;
  /** Server truth of initial follow state. */
  initialIsFollowing: boolean;
  /** Injected Server Action. */
  action: FollowAction;
  /** False when follow service is unavailable. */
  available?: boolean;
  className?: string;
}

/**
 * An accessible Follow / Following toggle button for a signed-in viewer.
 *
 * Presentational and action-injected: the action is passed in so tests and
 * stories can render it without server module imports.
 */
export function FollowButton({
  username,
  targetDisplayName,
  returnTo,
  initialIsFollowing,
  action,
  available = true,
  className,
}: FollowButtonProps) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState<
    FollowFormState,
    FormData
  >(action, initialFollowFormState);

  useEffect(() => {
    if (
      (state.status === "unauthenticated" || state.status === "onboarding") &&
      state.redirectTo
    ) {
      router.push(state.redirectTo);
    }
  }, [state, router]);

  const following =
    state.status === "success" && typeof state.isFollowing === "boolean"
      ? state.isFollowing
      : initialIsFollowing;

  const desiredNext = String(!following);

  const bannerError =
    state.status === "error" || state.status === "unavailable"
      ? state.message
      : !available
        ? "Following isn't available right now."
        : undefined;

  const label = following ? "Following" : "Follow";
  const accessibleName = following
    ? `Unfollow ${targetDisplayName}`
    : `Follow ${targetDisplayName}`;

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <form action={formAction}>
        <input type="hidden" name="username" value={username} />
        <input type="hidden" name="isFollow" value={desiredNext} />
        <input type="hidden" name="returnTo" value={returnTo} />

        <button
          type="submit"
          aria-pressed={following}
          aria-label={accessibleName}
          disabled={isPending || !available}
          className={cn(
            "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent",
            following
              ? "border-accent/40 bg-accent/10 text-accent hover:bg-accent/15"
              : "border-border/70 bg-surface-2 text-foreground/80 hover:border-border hover:text-foreground",
            (isPending || !available) &&
              "cursor-not-allowed opacity-60 hover:border-border/70",
          )}
        >
          {isPending ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : following ? (
            <Check className="size-4" aria-hidden="true" />
          ) : (
            <Plus className="size-4" aria-hidden="true" />
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
          ? "Updating follow status…"
          : state.status === "success"
            ? following
              ? `Following ${targetDisplayName}.`
              : `Unfollowed ${targetDisplayName}.`
            : ""}
      </p>
    </div>
  );
}
