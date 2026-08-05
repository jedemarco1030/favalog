import type { ReactNode } from "react";
import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { Container } from "@/components/ui/container";

interface AuthFormShellProps {
  /** Editorial page heading, e.g. "Welcome back". */
  title: string;
  /** One concise supporting line under the title. */
  subtitle?: ReactNode;
  /** The form (and any status banner) for this surface. */
  children: ReactNode;
  /** Optional links row rendered under the form (sign-in/up/forgot). */
  footer?: ReactNode;
}

/**
 * Shared frame for every auth screen.
 *
 * Deliberately NOT a giant centered SaaS card floating in empty space: it's a
 * calm, left-aligned editorial column that matches Favalog's dark, warm,
 * content-first design. The brand wordmark links home so "Return to Favalog"
 * is always one click away, and the person's name/heading is the single `h1`.
 */
export function AuthFormShell({
  title,
  subtitle,
  children,
  footer,
}: AuthFormShellProps) {
  return (
    <Container className="flex min-h-[70vh] max-w-md flex-col justify-center gap-8 py-12">
      <div className="flex flex-col gap-6">
        <Link
          href="/"
          aria-label="Favalog — home"
          className="w-fit rounded-md outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <Logo />
        </Link>
        <div className="flex flex-col gap-2">
          <h1 className="font-display text-3xl tracking-tight text-foreground">
            {title}
          </h1>
          {subtitle && (
            <p className="text-sm leading-relaxed text-foreground/60">
              {subtitle}
            </p>
          )}
        </div>
      </div>

      {children}

      {footer && (
        <div className="flex flex-col gap-2 text-sm text-foreground/60">
          {footer}
        </div>
      )}
    </Container>
  );
}
