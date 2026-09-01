import { Suspense } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { Container } from "@/components/ui/container";
import { Logo } from "@/components/brand/logo";
import { SearchInput } from "@/components/ui/search-input";
import { PrimaryNavLinks } from "@/components/layout/primary-nav-links";
import { HeaderAuth } from "@/components/layout/header-auth";
import { ThemeToggle } from "@/components/theme/theme-toggle";

/**
 * Application shell top bar. A Server Component: wordmark, primary nav
 * (desktop only — primary destinations move to `MobileNav`'s bottom tab bar on
 * small screens), search field (desktop only), a presentation-only
 * notifications button, and the session-aware auth cluster.
 *
 * `HeaderAuth` reads the session on the server (validated `getUser()`), so the
 * correct signed-in / signed-out control is in the initial HTML with no
 * client-side auth flash. It is wrapped in `Suspense` with a stable-sized
 * placeholder so the rest of the shell renders immediately while the session
 * resolves.
 */
export function SiteHeader() {
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

        {/* Right-hand utility cluster (theme + notifications + auth) */}
        <div className="ml-auto flex items-center gap-2 md:ml-0">
          <ThemeToggle />
          <button
            type="button"
            aria-label="Notifications"
            className="relative inline-flex size-9 items-center justify-center rounded-full border border-border/70 bg-surface-1 text-foreground/70 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <Bell className="size-4" aria-hidden="true" />
          </button>
          <Suspense
            fallback={
              <span
                aria-hidden="true"
                className="size-9 rounded-full bg-surface-1"
              />
            }
          >
            <HeaderAuth />
          </Suspense>
        </div>
      </Container>
    </header>
  );
}
