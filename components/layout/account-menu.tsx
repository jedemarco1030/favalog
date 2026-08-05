"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { ProfileAvatar } from "@/components/user/profile-avatar";

interface AccountMenuProps {
  displayName: string;
  /** Optional avatar artwork; falls back to initials. */
  avatarUrl?: string | null;
  /** Menu contents (profile link, sign-out control, etc.). */
  children: ReactNode;
}

/**
 * Signed-in account control: an avatar button that toggles a small dropdown
 * menu. Kept as the ONLY client component in the header's auth cluster — the
 * menu contents are passed in as server-rendered `children` (including the
 * sign-out Server Action form), so this file never imports server code and
 * there is no client-side auth flash.
 *
 * Accessibility: the trigger exposes `aria-haspopup="menu"` and `aria-expanded`
 * and is labelled with the person's name; the menu is a `role="menu"` region;
 * Escape and outside-click close it and return focus to the trigger.
 */
export function AccountMenu({
  displayName,
  avatarUrl,
  children,
}: AccountMenuProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    const handleClick = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };

    document.addEventListener("keydown", handleKey);
    document.addEventListener("mousedown", handleClick);
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.removeEventListener("mousedown", handleClick);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={`Account menu for ${displayName}`}
        onClick={() => setOpen((value) => !value)}
        className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        <ProfileAvatar
          displayName={displayName}
          avatarUrl={avatarUrl}
          decorative
        />
      </button>

      {open && (
        <div
          id={menuId}
          role="menu"
          aria-label="Account"
          className="absolute right-0 z-50 mt-2 w-52 overflow-hidden rounded-xl border border-border/70 bg-surface-1 py-1 shadow-xl shadow-black/40"
        >
          {children}
        </div>
      )}
    </div>
  );
}
