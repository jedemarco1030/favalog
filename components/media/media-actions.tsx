"use client";

import { BookmarkPlus, Eye, PenLine, Star } from "lucide-react";
import Link from "next/link";
import { useState, type ComponentType, type ReactNode } from "react";
import type { LucideProps } from "lucide-react";
import type { MediaItem } from "@/lib/types";
import type { PersonalTitleView } from "@/lib/supabase/diary";
import { logVerbLabel } from "@/lib/supabase/log-input";
import { diaryActionLabel } from "@/components/diary/diary-view";
import { StarRating } from "@/components/ui/star-rating";
import { LogDialog, type LogFocus } from "./log-dialog";
import { cn } from "@/lib/cn";

interface MediaActionsProps {
  item: MediaItem;
  /** True when a real, onboarded session is present (drives write vs. sign-in). */
  isAuthenticated: boolean;
  /** Safe same-origin path back to this title (sign-in `returnTo`). */
  returnTo: string;
  /** Pre-built safe sign-in URL for signed-out visitors. */
  signInHref: string;
  /** The viewer's most recent log for this title, when they've logged it. */
  personal: PersonalTitleView | null;
  className?: string;
}

const dateFormatter = new Intl.DateTimeFormat("en", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

/**
 * The title action row: Log / Rate / Review are real, accessible affordances,
 * while "Add to list" remains honestly unavailable (list persistence is out of
 * scope this phase).
 *
 * For a signed-out visitor the three actions are links into the safe sign-in
 * `returnTo` flow, with a short line making clear an account is required — no
 * dialog, no `localStorage`, no auth flash. For a signed-in, onboarded viewer
 * they open one shared {@link LogDialog}: Log at the general state, Rate with
 * the rating emphasised, Review with the review emphasised. When the viewer has
 * already logged the title we surface their latest date/rating and switch the
 * primary affordance to "Log again", defaulting the dialog to a revisit.
 */
export function MediaActions({
  item,
  isAuthenticated,
  returnTo,
  signInHref,
  personal,
  className,
}: MediaActionsProps) {
  const [dialog, setDialog] = useState<{ open: boolean; focus: LogFocus }>({
    open: false,
    focus: "log",
  });

  const hasLogged = personal !== null;
  const primaryLabel = hasLogged ? "Log again" : logVerbLabel(item.kind, false);

  const open = (focus: LogFocus) => setDialog({ open: true, focus });
  const close = () => setDialog((prev) => ({ ...prev, open: false }));

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      {hasLogged && personal && (
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-foreground/60">
          <span>
            {diaryActionLabel(personal.action)} on{" "}
            <time dateTime={personal.loggedAt}>
              {dateFormatter.format(new Date(personal.loggedAt))}
            </time>
          </span>
          {personal.rating != null && (
            <StarRating value={personal.rating} showNumeric />
          )}
        </p>
      )}

      <div
        role="group"
        aria-label={`Actions for ${item.title}`}
        className="flex flex-wrap items-center gap-2"
      >
        {isAuthenticated ? (
          <>
            <ActionButton
              icon={Eye}
              label={primaryLabel}
              tone="primary"
              onClick={() => open("log")}
            />
            <ActionButton
              icon={Star}
              label="Rate"
              onClick={() => open("rate")}
            />
            <ActionButton
              icon={PenLine}
              label="Review"
              onClick={() => open("review")}
            />
          </>
        ) : (
          <>
            <ActionLink
              icon={Eye}
              label={primaryLabel}
              tone="primary"
              href={signInHref}
            />
            <ActionLink icon={Star} label="Rate" href={signInHref} />
            <ActionLink icon={PenLine} label="Review" href={signInHref} />
          </>
        )}

        <ActionButton
          icon={BookmarkPlus}
          label="Add to list"
          disabled
          title="Add to list (coming soon)"
        />
      </div>

      {!isAuthenticated && (
        <p className="text-sm text-foreground/50">
          You&rsquo;ll need a free account to log, rate, and review titles.
        </p>
      )}

      {isAuthenticated && (
        <LogDialog
          open={dialog.open}
          onClose={close}
          focus={dialog.focus}
          item={item}
          returnTo={returnTo}
          defaultRevisit={hasLogged}
        />
      )}
    </div>
  );
}

const BASE_ACTION_CLASS =
  "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-accent";

function toneClass(tone: "primary" | "neutral"): string {
  return tone === "primary"
    ? "border-accent/40 bg-accent/10 text-accent hover:bg-accent/15"
    : "border-border/70 bg-surface-1 text-foreground/80 hover:border-border hover:text-foreground";
}

interface ActionButtonProps {
  icon: ComponentType<LucideProps>;
  label: string;
  tone?: "primary" | "neutral";
  onClick?: () => void;
  disabled?: boolean;
  title?: string;
}

function ActionButton({
  icon: Icon,
  label,
  tone = "neutral",
  onClick,
  disabled = false,
  title,
}: ActionButtonProps): ReactNode {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-disabled={disabled || undefined}
      disabled={disabled}
      title={title}
      className={cn(
        BASE_ACTION_CLASS,
        toneClass(tone),
        disabled && "cursor-not-allowed opacity-60 hover:border-border/70",
      )}
    >
      <Icon className="size-4" aria-hidden="true" />
      <span>{label}</span>
    </button>
  );
}

interface ActionLinkProps {
  icon: ComponentType<LucideProps>;
  label: string;
  href: string;
  tone?: "primary" | "neutral";
}

function ActionLink({
  icon: Icon,
  label,
  href,
  tone = "neutral",
}: ActionLinkProps): ReactNode {
  return (
    <Link href={href} className={cn(BASE_ACTION_CLASS, toneClass(tone))}>
      <Icon className="size-4" aria-hidden="true" />
      <span>{label}</span>
    </Link>
  );
}
