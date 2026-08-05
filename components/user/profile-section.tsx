import type { ReactNode } from "react";
import { SectionHeader } from "@/components/ui/section-header";
import { cn } from "@/lib/cn";

interface ProfileSectionProps {
  title: string;
  description?: string;
  /** Optional trailing link, e.g. "Browse all lists". */
  href?: string;
  linkLabel?: string;
  children: ReactNode;
  className?: string;
}

/**
 * A single titled block on the profile (Favorites, Reviews, Lists, …).
 *
 * A thin, consistent wrapper around `SectionHeader` (rendered as an `h2`, so
 * the profile keeps a clean single-`h1` heading hierarchy) plus its content.
 * The `<section>` is intentionally left without an accessible name so it does
 * not become a redundant landmark — the visible `h2` already gives screen
 * readers structure.
 */
export function ProfileSection({
  title,
  description,
  href,
  linkLabel,
  children,
  className,
}: ProfileSectionProps) {
  return (
    <section className={cn(className)}>
      <SectionHeader
        as="h2"
        title={title}
        description={description}
        href={href}
        linkLabel={linkLabel}
      />
      {children}
    </section>
  );
}
