"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Heart, Loader2 } from "lucide-react";
import {
  initialLikeFormState,
  type LikeFormState,
} from "@/components/likes/like-form";
import type { LikeTargetType } from "@/lib/supabase/like-input";
import { cn } from "@/lib/cn";

/** The set-like Server Action signature, injected (never imported here). */
export type LikeAction = (
  state: LikeFormState,
  formData: FormData,
) => Promise<LikeFormState>;

interface LikeButtonProps {
  /** Which kind of target this is. */
  targetType: LikeTargetType;
  /** The target's stable UUID; accessibility resolved server-side. */
  targetId: string;
  /** A short human label for the target, used only for the accessible name. */
  label: string;
  /** Server-loaded initial like count. */
  initialLikeCount: number;
  /** Server-loaded initial viewer-has-liked bit. */
  initialViewerHasLiked: boolean;
  /** True when a real, onboarded viewer is signed in. */
  isAuthenticated: boolean;
  /** Safe, same-origin sign-in href (with returnTo) for signed-out visitors. */
  signInHref: string;
  /** Safe, same-origin returnTo path for the expired-session case. */
  returnTo: string;
  /** The set-like Server Action, injected. */
  action: LikeAction;
  /** False when the like service is unavailable for this target. */
  available?: boolean;
  className?: string;
}

const numberFormatter = new Intl.NumberFormat("en-US");

/**
 * An accessible Like / Liked toggle showing a live count.
 *
 * Presentational and action-injected: the set-like Server Action is passed in,
 * so Storybook and tests can render every state without importing a
 * `"use server"` module. It submits a single trusted target id + kind plus the
 * DESIRED next boolean state; there is no browser Supabase call, `localStorage`,
 * or `getSession`.
 *
 * The displayed pressed state and count are SERVER TRUTH: they come from the
 * `initial*` props until an action succeeds, then from the ACTUAL values the
 * server returned — never an optimistic value that could contradict the write.
 * A signed-out visitor sees the real count and a control that routes to the
 * safe sign-in flow instead of a dead or lying button. While pending the button
 * is disabled (no duplicate submissions) and shows a spinner; an expired
 * session routes through sign-in; a failure surfaces a controlled message.
 */
export function LikeButton({
  targetType,
  targetId,
  label,
  initialLikeCount,
  initialViewerHasLiked,
  isAuthenticated,
  signInHref,
  returnTo,
  action,
  available = true,
  className,
}: LikeButtonProps) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState<
    LikeFormState,
    FormData
  >(action, initialLikeFormState);

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
  const liked =
    state.status === "success" && typeof state.isLiked === "boolean"
      ? state.isLiked
      : initialViewerHasLiked;
  const count =
    state.status === "success" && typeof state.likeCount === "number"
      ? state.likeCount
      : initialLikeCount;

  const countLabel = numberFormatter.format(Math.max(0, count));
  const likesWord = count === 1 ? "like" : "likes";

  // Signed-out: a real count plus a control that leads to sign-in. Rendered as
  // a link (not a form) so there is never a dead or dishonest toggle.
  if (!isAuthenticated) {
    return (
      <Link
        href={signInHref}
        aria-label={`Sign in to like ${label}`}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-surface-1 px-3 py-1.5 text-sm font-medium text-foreground/70 outline-none transition-colors hover:border-border hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent",
          className,
        )}
      >
        <Heart className="size-4" aria-hidden="true" />
        <span className="tabular-nums">{countLabel}</span>
        <span className="sr-only">{likesWord}</span>
      </Link>
    );
  }

  const desiredNext = String(!liked);

  const bannerError =
    state.status === "error" || state.status === "unavailable"
      ? state.message
      : !available
        ? "Liking isn't available right now."
        : undefined;

  const accessibleName = liked ? `Unlike ${label}` : `Like ${label}`;

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <form action={formAction}>
        <input type="hidden" name="targetType" value={targetType} />
        <input type="hidden" name="targetId" value={targetId} />
        <input type="hidden" name="isLiked" value={desiredNext} />
        <input type="hidden" name="returnTo" value={returnTo} />

        <button
          type="submit"
          aria-pressed={liked}
          aria-label={accessibleName}
          disabled={isPending || !available}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent",
            liked
              ? "border-accent/40 bg-accent/10 text-accent hover:bg-accent/15"
              : "border-border/70 bg-surface-1 text-foreground/70 hover:border-border hover:text-foreground",
            (isPending || !available) &&
              "cursor-not-allowed opacity-60 hover:border-border/70",
          )}
        >
          {isPending ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <Heart
              className={cn("size-4", liked && "fill-current")}
              aria-hidden="true"
            />
          )}
          <span className="tabular-nums">{countLabel}</span>
          <span className="sr-only">{likesWord}</span>
        </button>
      </form>

      {bannerError && (
        <p role="alert" className="text-sm text-red-300">
          {bannerError}
        </p>
      )}

      <p role="status" aria-live="polite" className="sr-only">
        {isPending
          ? "Updating your like…"
          : state.status === "success"
            ? liked
              ? `Liked ${label}.`
              : `Removed your like from ${label}.`
            : ""}
      </p>
    </div>
  );
}
