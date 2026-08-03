/**
 * Minimal class name joiner. Filters falsy values so `cn("a", cond && "b")`
 * works cleanly. Kept dependency-free — no `clsx` or `tailwind-merge` yet.
 */
export function cn(
  ...classes: Array<string | number | false | null | undefined>
): string {
  return classes
    .filter((value): value is string | number => Boolean(value))
    .join(" ");
}
