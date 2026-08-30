"use client";

import Image from "next/image";
import Link from "next/link";
import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ImageOff, Loader2, Plus } from "lucide-react";
import {
  initialMaterializeFormState,
  type MaterializeFormState,
} from "@/app/explore/materialize-form";
import type { ExternalResultView } from "@/lib/catalog/external-result-view-model";
import { mediaKindLabel } from "@/components/media/media-type-badge";
import { cn } from "@/lib/cn";

/** The materialize Server Action signature, injected (never imported here). */
export type MaterializeAction = (
  state: MaterializeFormState,
  formData: FormData,
) => Promise<MaterializeFormState>;

interface ExternalResultCardProps {
  result: ExternalResultView;
  /** True when a real, onboarded session is present (import vs. sign-in). */
  isAuthenticated: boolean;
  /** Pre-built safe sign-in URL for signed-out visitors. */
  signInHref: string;
  /** Safe same-origin path to return to after materialization (this Explore state). */
  returnTo: string;
  /** The materialize Server Action, injected so Storybook/tests need no server. */
  action: MaterializeAction;
}

/**
 * A provider-neutral external search result (Catalog Platform v1B).
 *
 * Renders a TMDB / Open Library candidate with a poster (or a graceful artwork
 * fallback), title, year, media kind, and provider attribution. It NEVER shows a
 * Favalog community rating, review, or popularity — an external candidate has
 * none, and none is fabricated.
 *
 * The action depends on the canonical resolution already folded into the view
 * model:
 *   - `existing`   → a link straight to the canonical `/title/[slug]` (no import
 *                    is ever offered for a title Favalog already has).
 *   - `importable` + authenticated → a real import form that submits ONLY the
 *                    identity triplet through the injected materialize action; on
 *                    success the SERVER redirects to the new title (no optimistic
 *                    success is ever shown). While pending the button is disabled
 *                    (no double submit) and shows a spinner.
 *   - `importable` + signed-out    → a neutral sign-in link through the safe
 *                    `returnTo` flow (never a personalized action).
 *
 * Presentational and action-injected: no browser Supabase, no provider calls,
 * no secrets.
 */
export function ExternalResultCard({
  result,
  isAuthenticated,
  signInHref,
  returnTo,
  action,
}: ExternalResultCardProps) {
  const kindLabel = mediaKindLabel(result.kind);
  const meta = [kindLabel, result.year ? String(result.year) : null]
    .filter(Boolean)
    .join(" · ");

  return (
    <article className="flex flex-col gap-3 rounded-lg border border-border/50 bg-surface-1/60 p-3">
      <ExternalPoster result={result} />
      <div className="flex min-w-0 flex-col gap-1.5">
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-wide text-foreground/50">
          <span>{meta}</span>
        </div>
        <h3 className="font-display text-base leading-snug text-foreground">
          {result.title}
        </h3>
        {result.creators && (
          <p className="truncate text-sm text-foreground/60">
            {result.creators}
          </p>
        )}
        <p className="text-xs text-foreground/40">via {result.providerLabel}</p>
      </div>

      {result.status === "existing" && result.existingSlug ? (
        <Link
          href={`/title/${result.existingSlug}`}
          className="inline-flex items-center justify-center gap-2 rounded-full border border-border/70 bg-surface-1 px-4 py-2 text-sm font-medium text-foreground/80 outline-none transition-colors hover:border-border hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent"
        >
          In your catalog · View
        </Link>
      ) : isAuthenticated ? (
        <ImportForm result={result} returnTo={returnTo} action={action} />
      ) : (
        <Link
          href={signInHref}
          className="inline-flex items-center justify-center gap-2 rounded-full border border-accent/40 bg-accent/10 px-4 py-2 text-sm font-medium text-accent outline-none transition-colors hover:bg-accent/15 focus-visible:ring-2 focus-visible:ring-accent"
        >
          <Plus className="size-4" aria-hidden="true" />
          Sign in to add
        </Link>
      )}
    </article>
  );
}

/** The import form for an authenticated viewer. Submits identity only. */
function ImportForm({
  result,
  returnTo,
  action,
}: {
  result: ExternalResultView;
  returnTo: string;
  action: MaterializeAction;
}) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState<
    MaterializeFormState,
    FormData
  >(action, initialMaterializeFormState);

  // Auth / onboarding gates are returned to the client for a safe redirect
  // (never a server redirect); a successful import is a SERVER redirect, so it
  // never returns here.
  useEffect(() => {
    if (
      (state.status === "unauthenticated" || state.status === "onboarding") &&
      state.redirectTo
    ) {
      router.push(state.redirectTo);
    }
  }, [state, router]);

  const error =
    state.status === "error" || state.status === "unavailable"
      ? state.message
      : undefined;

  return (
    <div className="flex flex-col gap-1">
      <form action={formAction}>
        <input type="hidden" name="provider" value={result.provider} />
        <input type="hidden" name="kind" value={result.kind} />
        <input type="hidden" name="externalId" value={result.externalId} />
        <input type="hidden" name="returnTo" value={returnTo} />
        <button
          type="submit"
          disabled={isPending}
          aria-label={`Add ${result.title} to Favalog`}
          className={cn(
            "inline-flex w-full items-center justify-center gap-2 rounded-full border border-accent/40 bg-accent/10 px-4 py-2 text-sm font-medium text-accent outline-none transition-colors hover:bg-accent/15 focus-visible:ring-2 focus-visible:ring-accent",
            isPending && "cursor-not-allowed opacity-60 hover:bg-accent/10",
          )}
        >
          {isPending ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <Plus className="size-4" aria-hidden="true" />
          )}
          <span>{isPending ? "Adding…" : "Add to Favalog"}</span>
        </button>
      </form>

      {error && (
        <p role="alert" className="text-sm text-red-300">
          {error}
        </p>
      )}

      <p role="status" aria-live="polite" className="sr-only">
        {isPending ? `Adding ${result.title} to Favalog…` : ""}
      </p>
    </div>
  );
}

/** Poster with a graceful fallback when the provider has no artwork. */
function ExternalPoster({ result }: { result: ExternalResultView }) {
  if (!result.posterUrl) {
    return (
      <div className="flex aspect-[2/3] w-full items-center justify-center rounded-lg bg-surface-2 ring-1 ring-inset ring-border/60">
        <ImageOff className="size-8 text-foreground/30" aria-hidden="true" />
        <span className="sr-only">No artwork available</span>
      </div>
    );
  }
  return (
    <div className="relative aspect-[2/3] w-full overflow-hidden rounded-lg bg-surface-2 ring-1 ring-inset ring-border/60">
      <Image
        src={result.posterUrl}
        alt=""
        fill
        sizes="(min-width: 1024px) 20vw, (min-width: 640px) 33vw, 50vw"
        className="object-cover"
      />
    </div>
  );
}
