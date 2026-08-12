"use client";

import { BookmarkPlus, Eye, PenLine, Pencil, Star, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState, type ComponentType, type ReactNode } from "react";
import type { LucideProps } from "lucide-react";
import type { MediaItem } from "@/lib/types";
import type { PersonalTitleView } from "@/lib/supabase/diary";
import { logTitleAction } from "@/app/title/[slug]/actions";
import {
  deleteDiaryEntryAction,
  editDiaryEntryAction,
} from "@/app/diary/actions";
import { diaryActionLabel } from "@/components/diary/diary-view";
import { StarRating } from "@/components/ui/star-rating";
import { LogDialog, type LogFocus } from "./log-dialog";
import { DeleteLogDialog } from "./delete-log-dialog";
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
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const hasLogged = personal !== null;
  // The primary affordance is always "Log" (a new entry). Existing personal
  // state — the verb, rating, date, review — is shown only below, and only for
  // an authenticated viewer whose own data backs it. "Log again" simply signals
  // a repeat log; it never implies the app knows a signed-out visitor watched.
  const primaryLabel = hasLogged ? "Log again" : "Log";

  const open = (focus: LogFocus) => setDialog({ open: true, focus });
  const close = () => setDialog((prev) => ({ ...prev, open: false }));

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      {hasLogged && personal && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-foreground/60">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
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
          {/* Owner-only edit/delete for the latest personal state. */}
          <span className="flex items-center gap-1">
            <IconButton
              icon={Pencil}
              label="Edit log"
              onClick={() => setEditOpen(true)}
            />
            <IconButton
              icon={Trash2}
              label="Delete log"
              tone="danger"
              onClick={() => setDeleteOpen(true)}
            />
          </span>
        </div>
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
          action={logTitleAction}
          item={item}
          returnTo={returnTo}
          defaultRevisit={hasLogged}
        />
      )}

      {isAuthenticated && personal && (
        <>
          <LogDialog
            // Remount when the stored entry changes (e.g. after a save) so the
            // pre-filled fields never show stale values.
            key={editDialogKey(personal)}
            open={editOpen}
            onClose={() => setEditOpen(false)}
            focus="log"
            mode="edit"
            action={editDiaryEntryAction}
            diaryEntryId={personal.diaryEntryId}
            item={item}
            returnTo={returnTo}
            defaultRevisit={personal.isRevisit}
            initialValues={{
              loggedAt: personal.loggedAt,
              rating: personal.rating ?? null,
              isRevisit: personal.isRevisit,
              reviewTitle: personal.reviewTitle,
              reviewBody: personal.reviewBody,
              containsSpoilers: personal.containsSpoilers,
            }}
          />
          <DeleteLogDialog
            open={deleteOpen}
            onClose={() => setDeleteOpen(false)}
            action={deleteDiaryEntryAction}
            diaryEntryId={personal.diaryEntryId}
            title={item.title}
            loggedAt={personal.loggedAt}
            returnTo={returnTo}
          />
        </>
      )}
    </div>
  );
}

/** A stable key for the edit dialog that changes when the entry's values do. */
function editDialogKey(personal: PersonalTitleView): string {
  return [
    personal.diaryEntryId,
    personal.loggedAt,
    personal.rating ?? "",
    personal.isRevisit ? "1" : "0",
    personal.reviewTitle ?? "",
    personal.reviewBody ?? "",
    personal.containsSpoilers ? "1" : "0",
  ].join("|");
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

interface IconButtonProps {
  icon: ComponentType<LucideProps>;
  /** Accessible name (also the tooltip); the button is icon-only. */
  label: string;
  onClick: () => void;
  tone?: "neutral" | "danger";
}

/** A compact, icon-only owner control (edit / delete) with an accessible name. */
function IconButton({
  icon: Icon,
  label,
  onClick,
  tone = "neutral",
}: IconButtonProps): ReactNode {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={cn(
        "inline-flex size-8 items-center justify-center rounded-full border border-border/60 bg-surface-1 outline-none transition-colors hover:border-border focus-visible:ring-2 focus-visible:ring-accent",
        tone === "danger"
          ? "text-foreground/60 hover:text-red-300"
          : "text-foreground/60 hover:text-foreground",
      )}
    >
      <Icon className="size-4" aria-hidden="true" />
    </button>
  );
}
