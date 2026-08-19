"use client";

import { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { EditListDialog } from "@/components/lists/edit-list-dialog";
import { DeleteListDialog } from "@/components/lists/delete-list-dialog";
import type { EditListAction } from "@/components/lists/edit-list-form";
import type { DeleteListAction } from "@/components/lists/delete-list-dialog";
import type { ListCreateVisibility } from "@/lib/types";

interface RealListOwnerActionsProps {
  listId: string;
  title: string;
  description: string | null;
  isRanked: boolean;
  /** Reconciled to a creatable value (`followers` prefills as `private`). */
  visibility: ListCreateVisibility;
  /** Safe, same-origin `returnTo` (this list route). */
  returnTo: string;
  /** The edit-list Server Action, injected (never imported here). */
  editAction: EditListAction;
  /** The delete-list Server Action, injected (never imported here). */
  deleteAction: DeleteListAction;
}

/**
 * Owner-only controls for a real `/list/[slug]`: Edit list and Delete list.
 *
 * Rendered by {@link RealListDetail} only when the viewer owns the list, so
 * signed-out visitors, non-owners, and mock-list viewers never see it. The two
 * dialogs stay mounted (open toggles) so closing restores focus to the
 * triggering control. The edit dialog keeps the person on the immutable
 * canonical URL; the delete dialog navigates to `/lists` on success.
 */
export function RealListOwnerActions({
  listId,
  title,
  description,
  isRanked,
  visibility,
  returnTo,
  editAction,
  deleteAction,
}: RealListOwnerActionsProps) {
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-surface-1 px-4 py-2 text-sm font-medium text-foreground/80 outline-none transition-colors hover:border-border hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent"
      >
        <Pencil className="size-4" aria-hidden="true" />
        Edit list
      </button>
      <button
        type="button"
        onClick={() => setDeleting(true)}
        className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-surface-1 px-4 py-2 text-sm font-medium text-foreground/70 outline-none transition-colors hover:border-red-500/50 hover:text-red-300 focus-visible:ring-2 focus-visible:ring-accent"
      >
        <Trash2 className="size-4" aria-hidden="true" />
        Delete list
      </button>

      <EditListDialog
        open={editing}
        onClose={() => setEditing(false)}
        action={editAction}
        initial={{ listId, title, description, isRanked, visibility }}
        returnTo={returnTo}
      />
      <DeleteListDialog
        open={deleting}
        onClose={() => setDeleting(false)}
        listId={listId}
        listTitle={title}
        returnTo={returnTo}
        action={deleteAction}
      />
    </div>
  );
}
