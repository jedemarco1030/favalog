import { Search } from "lucide-react";
import { cn } from "@/lib/cn";

interface SearchInputProps {
  id?: string;
  placeholder?: string;
  className?: string;
  /** Accessible label announced by screen readers; visually hidden. */
  label?: string;
  /** Optional keyboard hint (e.g. `⌘K`) shown on the right side. */
  hint?: string;
  autoFocus?: boolean;
}

/**
 * Presentation-only search field. This is a Server Component: it renders
 * a real `<input>` inside a `<form>` so the field is keyboard-focusable and
 * screen-reader friendly, but no search behavior is wired up yet.
 *
 * When we introduce a real search backend, add a Client wrapper that reads
 * the input value — this element itself stays UI-only.
 */
export function SearchInput({
  id = "site-search",
  placeholder = "Search movies, shows, books...",
  className,
  label = "Search Favalog",
  hint,
  autoFocus,
}: SearchInputProps) {
  return (
    <form
      role="search"
      action="/explore"
      className={cn("relative flex w-full items-center", className)}
    >
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <Search
        className="pointer-events-none absolute left-3 size-4 text-foreground/50"
        aria-hidden="true"
      />
      <input
        id={id}
        name="q"
        type="search"
        placeholder={placeholder}
        autoComplete="off"
        autoFocus={autoFocus}
        className="h-10 w-full rounded-full border border-border/70 bg-surface-1 pl-9 pr-14 text-sm text-foreground placeholder:text-foreground/40 outline-none transition-colors focus:border-accent/60 focus-visible:ring-2 focus-visible:ring-accent"
      />
      {hint && (
        <kbd
          aria-hidden="true"
          className="pointer-events-none absolute right-3 hidden rounded border border-border/70 bg-surface-2 px-1.5 py-0.5 font-mono text-[10px] text-foreground/50 sm:inline-block"
        >
          {hint}
        </kbd>
      )}
    </form>
  );
}
