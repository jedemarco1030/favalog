"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Compass,
  Home,
  ListChecks,
  NotebookPen,
  Search,
  X,
  type LucideIcon,
} from "lucide-react";
import { PRIMARY_NAV } from "@/components/layout/nav-items";
import { SearchInput } from "@/components/ui/search-input";
import { cn } from "@/lib/cn";

const TAB_ICON: Record<string, LucideIcon> = {
  "/": Home,
  "/explore": Compass,
  "/diary": NotebookPen,
  "/lists": ListChecks,
};

/**
 * Mobile-only bottom tab bar: one tap to Home, Explore, Diary, or Lists,
 * plus a Search tab that opens a full-screen search sheet. This is a
 * dedicated pattern for a social entertainment app rather than a
 * compressed version of the desktop nav — notifications and the profile
 * control live in the header on every breakpoint.
 *
 * The only interaction state here is the search sheet's open/closed
 * state and Escape/scroll-lock handling, so this stays the one Client
 * Component in the primary navigation.
 */
export function MobileNav() {
  const pathname = usePathname();
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    if (!searchOpen) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSearchOpen(false);
    };
    document.addEventListener("keydown", handleKey);
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = original;
    };
  }, [searchOpen]);

  return (
    <>
      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border/60 bg-background/95 backdrop-blur-md md:hidden"
      >
        <ul className="flex items-stretch">
          {PRIMARY_NAV.map((item) => {
            const isActive =
              item.href === "/"
                ? pathname === "/"
                : pathname?.startsWith(item.href);
            const Icon = TAB_ICON[item.href] ?? Home;
            return (
              <li key={item.href} className="flex-1">
                <Link
                  href={item.href}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "flex min-h-14 flex-col items-center justify-center gap-1 text-[11px] outline-none focus-visible:ring-2 focus-visible:ring-accent",
                    isActive
                      ? "text-foreground"
                      : "text-foreground/50 hover:text-foreground/80",
                  )}
                >
                  <Icon className="size-5" aria-hidden="true" />
                  {item.label}
                </Link>
              </li>
            );
          })}
          <li className="flex-1">
            <button
              type="button"
              aria-label="Search"
              aria-expanded={searchOpen}
              onClick={() => setSearchOpen(true)}
              className="flex min-h-14 w-full flex-col items-center justify-center gap-1 text-[11px] text-foreground/50 outline-none hover:text-foreground/80 focus-visible:ring-2 focus-visible:ring-accent"
            >
              <Search className="size-5" aria-hidden="true" />
              Search
            </button>
          </li>
        </ul>
      </nav>

      {searchOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Search"
          className="fixed inset-0 z-50 bg-background/98 px-6 pt-20 backdrop-blur-md md:hidden"
        >
          <div className="flex items-center gap-3">
            <SearchInput autoFocus className="flex-1" />
            <button
              type="button"
              aria-label="Close search"
              onClick={() => setSearchOpen(false)}
              className="inline-flex size-10 shrink-0 items-center justify-center rounded-full border border-border/70 text-foreground/70 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
