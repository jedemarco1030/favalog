import Link from "next/link";
import { Bell } from "lucide-react";
import { Container } from "@/components/ui/container";
import { Logo } from "@/components/brand/logo";
import { SearchInput } from "@/components/ui/search-input";
import { UserAvatar } from "@/components/user/user-avatar";
import { PrimaryNavLinks } from "@/components/layout/primary-nav-links";
import { users } from "@/lib/data";

/**
 * Application shell top bar. A Server Component: wordmark, primary nav
 * (desktop only — primary destinations move to `MobileNav`'s bottom tab
 * bar on small screens), search field (desktop only — mobile search lives
 * in the tab bar's search sheet), notifications button, and an avatar menu
 * placeholder. Both breakpoints get notifications and the avatar here.
 *
 * `SearchInput`, `Bell`, and the avatar are intentionally presentation-only
 * — no backend, no auth, no notifications yet.
 */
export function SiteHeader() {
  // Purely visual: pick a stable mock viewer so the avatar has a real image.
  const viewer = users[0];

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-md">
      <Container className="flex h-16 items-center gap-4">
        <Link
          href="/"
          className="rounded-md outline-none focus-visible:ring-2 focus-visible:ring-accent"
          aria-label="Favalog — home"
        >
          <Logo />
        </Link>

        {/* Desktop primary nav */}
        <nav aria-label="Primary" className="ml-4 hidden md:block">
          <PrimaryNavLinks />
        </nav>

        {/* Desktop search — expands to take the remaining space */}
        <div className="ml-auto hidden max-w-sm flex-1 md:block">
          <SearchInput hint="⌘K" />
        </div>

        {/* Right-hand utility cluster (notifications + avatar) */}
        <div className="ml-auto flex items-center gap-2 md:ml-0">
          <button
            type="button"
            aria-label="Notifications"
            className="relative inline-flex size-9 items-center justify-center rounded-full border border-border/70 bg-surface-1 text-foreground/70 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <Bell className="size-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label="Account menu"
            className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <UserAvatar user={viewer} size="md" decorative />
          </button>
        </div>
      </Container>
    </header>
  );
}
