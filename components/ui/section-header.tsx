import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/cn";

interface SectionHeaderProps {
  title: string;
  description?: string;
  /** Optional trailing link, e.g. "Browse all". */
  href?: string;
  linkLabel?: string;
  /** Heading level. Defaults to `h2`. */
  as?: "h1" | "h2" | "h3";
  className?: string;
  children?: ReactNode;
}

/**
 * Section title + optional description + optional trailing link, used to
 * introduce a rail, list, or block on any page.
 */
export function SectionHeader({
  title,
  description,
  href,
  linkLabel = "Browse all",
  as: Heading = "h2",
  className,
  children,
}: SectionHeaderProps) {
  return (
    <div className={cn("mb-6 flex items-end justify-between gap-4", className)}>
      <div className="min-w-0">
        <Heading className="font-display text-2xl tracking-tight text-foreground">
          {title}
        </Heading>
        {description && (
          <p className="mt-1 text-sm text-foreground/60">{description}</p>
        )}
      </div>
      {children ??
        (href && (
          <Link
            href={href}
            className="inline-flex shrink-0 items-center gap-1 text-sm text-foreground/70 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            {linkLabel} <ArrowUpRight className="size-4" aria-hidden="true" />
          </Link>
        ))}
    </div>
  );
}
