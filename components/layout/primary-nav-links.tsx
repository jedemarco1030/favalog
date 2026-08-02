"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PRIMARY_NAV } from "@/components/layout/nav-items";
import { cn } from "@/lib/cn";

/**
 * Desktop primary nav links with an accessible active state driven by the
 * current pathname. Client-only because `usePathname` is a client hook —
 * kept intentionally small.
 */
export function PrimaryNavLinks() {
  const pathname = usePathname();
  return (
    <ul className="flex items-center gap-7 text-sm">
      {PRIMARY_NAV.map((item) => {
        const isActive =
          item.href === "/"
            ? pathname === "/"
            : pathname?.startsWith(item.href);
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "rounded transition-colors outline-none focus-visible:ring-2 focus-visible:ring-accent",
                isActive
                  ? "text-foreground"
                  : "text-foreground/60 hover:text-foreground",
              )}
            >
              {item.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
