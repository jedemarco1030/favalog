import { ChevronDown } from "lucide-react";
import type { SelectHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

interface StyledSelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  /** Extra classes for the outer wrapper (e.g. width control). */
  wrapperClassName?: string;
}

/**
 * A small, reusable styled wrapper around a real native `<select>`.
 *
 * The browser-native caret is inconsistent across platforms and misaligns
 * against pill-shaped controls, so we hide it with `appearance-none` and render
 * a decorative {@link ChevronDown} in a `pointer-events-none` wrapper, vertically
 * centred and inset from the right edge. Sufficient right padding is reserved so
 * the value text and the chevron never overlap.
 *
 * This is deliberately NOT a custom listbox: it keeps the underlying native
 * `<select>`, so keyboard interaction, screen-reader semantics, `disabled`,
 * focus, and form submission all behave exactly as the platform provides. All
 * native props (`value`, `onChange`, `disabled`, `aria-*`, `name`, `id`, …) are
 * forwarded straight through, and the option elements are passed as children.
 */
export function StyledSelect({
  className,
  wrapperClassName,
  disabled,
  children,
  ...props
}: StyledSelectProps) {
  return (
    <div className={cn("relative inline-flex", wrapperClassName)}>
      <select
        {...props}
        disabled={disabled}
        className={cn(
          "h-9 w-full appearance-none rounded-full border border-border/70 bg-surface-1 pl-3 pr-9 text-sm text-foreground outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-60",
          className,
        )}
      >
        {children}
      </select>
      <ChevronDown
        aria-hidden="true"
        className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-foreground/60"
      />
    </div>
  );
}
