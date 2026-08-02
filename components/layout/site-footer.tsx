import Link from "next/link";
import { Container } from "@/components/ui/container";
import { Logo } from "@/components/brand/logo";
import { PRIMARY_NAV } from "@/components/layout/nav-items";

/**
 * Quiet footer. No demo/portfolio labeling here — the product should read
 * as a real consumer application.
 */
export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-border/60 pt-10 pb-24 text-sm text-foreground/50 md:pb-10">
      <Container className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
        <div className="flex flex-col gap-2">
          <Logo />
          <p className="max-w-sm text-foreground/50">
            Everything you watch and read. One place to remember it.
          </p>
        </div>
        <nav aria-label="Footer">
          <ul className="flex flex-wrap items-center gap-x-6 gap-y-2 text-foreground/60">
            {PRIMARY_NAV.map((item) => (
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
        <p className="text-xs text-foreground/40">
          © {new Date().getFullYear()} Favalog
        </p>
      </Container>
    </footer>
  );
}
