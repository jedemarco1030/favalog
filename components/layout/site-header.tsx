import Link from "next/link";
import { Search } from "lucide-react";
import { Container } from "@/components/ui/container";
import { Logo } from "@/components/brand/logo";

const NAV = [
  { href: "/", label: "Home" },
  { href: "/films", label: "Films" },
  { href: "/series", label: "Series" },
  { href: "/books", label: "Books" },
  { href: "/activity", label: "Activity" },
] as const;

/**
 * Top navigation bar. Links point at routes that will be filled in during
 * subsequent MVP work — for now they are anchor placeholders so the shell
 * is fully keyboard-navigable and screen-reader friendly.
 */
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-md">
      <Container className="flex h-16 items-center justify-between gap-6">
        <Link
          href="/"
          className="rounded-md outline-none focus-visible:ring-2 focus-visible:ring-accent"
          aria-label="Lorely home"
        >
          <Logo />
        </Link>
        <nav aria-label="Primary" className="hidden md:block">
          <ul className="flex items-center gap-7 text-sm text-foreground/70">
            {NAV.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="rounded transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="inline-flex size-9 items-center justify-center rounded-full border border-border/70 bg-surface-1 text-foreground/70 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            aria-label="Search"
          >
            <Search className="size-4" aria-hidden="true" />
          </button>
          <Link
            href="/join"
            className="hidden rounded-full bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:inline-flex"
          >
            Join Lorely
          </Link>
        </div>
      </Container>
    </header>
  );
}
