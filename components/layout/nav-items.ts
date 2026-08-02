/**
 * Primary navigation for the Favalog product shell.
 *
 * These are the only top-level destinations. Media type (movies / TV / books)
 * is a filter inside Explore, never a top-level nav entry.
 */
export interface NavItem {
  href: string;
  label: string;
}

export const PRIMARY_NAV: readonly NavItem[] = [
  { href: "/", label: "Home" },
  { href: "/explore", label: "Explore" },
  { href: "/diary", label: "Diary" },
  { href: "/lists", label: "Lists" },
] as const;
