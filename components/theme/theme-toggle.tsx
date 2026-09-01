"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Check, Monitor, Moon, Sun, type LucideIcon } from "lucide-react";
import { useTheme } from "@/components/theme/theme-provider";
import { THEME_OPTIONS, type ThemePreference } from "@/lib/theme";
import { cn } from "@/lib/cn";

const OPTION_META: Record<
  ThemePreference,
  { label: string; Icon: LucideIcon }
> = {
  light: { label: "Light", Icon: Sun },
  dark: { label: "Dark", Icon: Moon },
  system: { label: "System", Icon: Monitor },
};

/**
 * Accessible theme control: a small trigger button that opens a menu of the
 * three preferences (Light / Dark / System). Mirrors the header's
 * `AccountMenu` interaction contract — `aria-haspopup="menu"` + `aria-expanded`
 * trigger, a `role="menu"` region, `role="menuitemradio"` options reflecting
 * the current choice with `aria-checked`, and Escape / outside-click dismissal
 * that returns focus to the trigger.
 *
 * The trigger icon reflects the *resolved* theme (what is painting), and its
 * label announces the current preference so screen-reader users know both the
 * control's purpose and its state. It fits the shared header utility cluster,
 * so it is available on desktop and mobile without a separate layout.
 */
export function ThemeToggle() {
  const { preference, resolvedTheme, setPreference } = useTheme();
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

  const TriggerIcon = resolvedTheme === "dark" ? Moon : Sun;

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={`Theme: ${OPTION_META[preference].label}`}
        onClick={() => setOpen((value) => !value)}
        className="relative inline-flex size-9 items-center justify-center rounded-full border border-border/70 bg-surface-1 text-foreground/70 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <TriggerIcon className="size-4" aria-hidden="true" />
      </button>

      {open && (
        <div
          id={menuId}
          role="menu"
          aria-label="Theme"
          className="absolute right-0 z-50 mt-2 w-44 overflow-hidden rounded-xl border border-border/70 bg-surface-1 py-1 shadow-xl shadow-black/40"
        >
          {THEME_OPTIONS.map((option) => {
            const { label, Icon } = OPTION_META[option];
            const selected = preference === option;
            return (
              <button
                key={option}
                type="button"
                role="menuitemradio"
                aria-checked={selected}
                onClick={() => {
                  setPreference(option);
                  setOpen(false);
                  triggerRef.current?.focus();
                }}
                className={cn(
                  "flex w-full items-center gap-3 px-4 py-2 text-left text-sm transition-colors hover:bg-surface-2 focus-visible:bg-surface-2 focus-visible:outline-none",
                  selected ? "text-foreground" : "text-foreground/80",
                )}
              >
                <Icon className="size-4 shrink-0" aria-hidden="true" />
                <span className="flex-1">{label}</span>
                {selected && (
                  <Check
                    className="size-4 shrink-0 text-accent"
                    aria-hidden="true"
                  />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
