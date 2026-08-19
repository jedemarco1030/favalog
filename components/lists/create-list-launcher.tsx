"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { createListAction } from "@/app/lists/actions";
import { CreateListDialog } from "@/components/lists/create-list-dialog";

interface CreateListLauncherProps {
  /**
   * "signed-in" opens the create dialog; "signed-out" links to sign-in with a
   * safe `returnTo`; "unavailable" shows a controlled disabled state (no env).
   */
  variant: "signed-in" | "signed-out" | "unavailable";
  /** Safe, same-origin `returnTo` (the lists route). */
  returnTo: string;
  /** Pre-built safe sign-in URL for the signed-out case. */
  signInHref: string;
}

const BUTTON_CLASS =
  "inline-flex h-10 items-center gap-2 rounded-lg bg-accent px-4 text-sm font-medium text-accent-foreground outline-none transition-colors hover:bg-accent-strong focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background";

/**
 * The "Create list" entry point for `/lists`.
 *
 * A signed-in viewer opens the reusable {@link CreateListDialog} (which
 * navigates to the server-returned canonical `/list/[slug]` on success). A
 * signed-out visitor gets a real sign-in link through the safe `returnTo` flow
 * — never a fake local creation experience. When persistence is unavailable
 * (no Supabase env) the control is a controlled, clearly-disabled affordance.
 */
export function CreateListLauncher({
  variant,
  returnTo,
  signInHref,
}: CreateListLauncherProps) {
  const [open, setOpen] = useState(false);

  if (variant === "signed-out") {
    return (
      <Link href={signInHref} className={BUTTON_CLASS}>
        <Plus className="size-4" aria-hidden="true" />
        Create list
      </Link>
    );
  }

  if (variant === "unavailable") {
    return (
      <button
        type="button"
        disabled
        aria-disabled="true"
        title="Creating lists isn't available in this environment yet."
        className={`${BUTTON_CLASS} cursor-not-allowed opacity-60`}
      >
        <Plus className="size-4" aria-hidden="true" />
        Create list
      </button>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={BUTTON_CLASS}
      >
        <Plus className="size-4" aria-hidden="true" />
        Create list
      </button>
      <CreateListDialog
        open={open}
        onClose={() => setOpen(false)}
        action={createListAction}
        returnTo={returnTo}
      />
    </>
  );
}
