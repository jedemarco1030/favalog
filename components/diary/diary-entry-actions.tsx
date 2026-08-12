"use client";

import { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import {
  deleteDiaryEntryAction,
  editDiaryEntryAction,
} from "@/app/diary/actions";
import { LogDialog } from "@/components/media/log-dialog";
import { DeleteLogDialog } from "@/components/media/delete-log-dialog";
import type { DiaryEntryView } from "@/components/diary/diary-view";
import { cn } from "@/lib/cn";

interface DiaryEntryActionsProps {
  entry: DiaryEntryView;
}

/**
 * Owner-only edit/delete controls for a single real diary row.
 *
 * Rendered ONLY for the authenticated owner's real diary (the signed-out
 * example diary never mounts this), and only when the row carries its raw
 * `edit` values. Reuses the shared {@link LogDialog} (in edit mode, pre-filled
 * from the entry) and {@link DeleteLogDialog}, submitting to the same
 * authoritative Server Actions the title page uses. `returnTo` is `/diary` so an
 * expired session returns the person here after signing in.
 */
export function DiaryEntryActions({ entry }: DiaryEntryActionsProps) {
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const edit = entry.edit;
  if (!edit) return null;

  return (
    <div className="flex items-center gap-1">
      <IconButton
        label={`Edit your log of ${entry.title}`}
        onClick={() => setEditOpen(true)}
      >
        <Pencil className="size-4" aria-hidden="true" />
      </IconButton>
      <IconButton
        label={`Delete your log of ${entry.title}`}
        tone="danger"
        onClick={() => setDeleteOpen(true)}
      >
        <Trash2 className="size-4" aria-hidden="true" />
      </IconButton>

      <LogDialog
        open={editOpen}
        onClose={() => setEditOpen(false)}
        focus="log"
        mode="edit"
        action={editDiaryEntryAction}
        diaryEntryId={entry.id}
        item={{ kind: entry.kind, slug: entry.slug, title: entry.title }}
        returnTo="/diary"
        defaultRevisit={edit.isRevisit}
        initialValues={{
          loggedAt: entry.loggedAt,
          rating: entry.rating ?? null,
          isRevisit: edit.isRevisit,
          reviewTitle: edit.reviewTitle,
          reviewBody: edit.reviewBody,
          containsSpoilers: edit.containsSpoilers,
        }}
      />
      <DeleteLogDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        action={deleteDiaryEntryAction}
        diaryEntryId={entry.id}
        title={entry.title}
        loggedAt={entry.loggedAt}
        returnTo="/diary"
      />
    </div>
  );
}

interface IconButtonProps {
  label: string;
  onClick: () => void;
  tone?: "neutral" | "danger";
  children: React.ReactNode;
}

function IconButton({
  label,
  onClick,
  tone = "neutral",
  children,
}: IconButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={cn(
        "inline-flex size-8 items-center justify-center rounded-full border border-border/60 bg-surface-1 outline-none transition-colors hover:border-border focus-visible:ring-2 focus-visible:ring-accent",
        tone === "danger"
          ? "text-foreground/50 hover:text-red-300"
          : "text-foreground/50 hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
