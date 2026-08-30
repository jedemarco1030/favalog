import Image from "next/image";
import type { ExternalProvider } from "@/lib/catalog/types";
import { cn } from "@/lib/cn";

/**
 * Required attribution for external catalog providers (Catalog Platform v1B).
 *
 * TMDB mandates a specific notice AND their logo wherever TMDB data is shown,
 * and requires that we do NOT imply endorsement. Open Library asks that we
 * credit and link back. This component renders the correct attribution for the
 * given provider so every federated section that surfaces provider results
 * carries it in one consistent, accessible place.
 *
 * Presentational and dependency-free (no I/O, no secrets) so it renders in
 * Storybook and tests unchanged. The TMDB logo asset (`/tmdb.svg`) is an
 * in-repo APPROXIMATION for development; the approved brand asset must replace
 * it before production (see the file's own note and the system card).
 */

/** The exact notice TMDB requires; must appear verbatim wherever TMDB data shows. */
export const TMDB_ATTRIBUTION_NOTICE =
  "This product uses the TMDB API but is not endorsed or certified by TMDB.";

interface ProviderAttributionProps {
  provider: ExternalProvider;
  className?: string;
}

export function ProviderAttribution({
  provider,
  className,
}: ProviderAttributionProps) {
  if (provider === "tmdb") {
    return (
      <div
        className={cn(
          "flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-foreground/50",
          className,
        )}
      >
        <Image
          src="/tmdb.svg"
          alt="TMDB"
          width={52}
          height={7}
          className="h-3 w-auto"
        />
        <span>{TMDB_ATTRIBUTION_NOTICE}</span>
      </div>
    );
  }

  return (
    <p className={cn("text-xs text-foreground/50", className)}>
      Book data from{" "}
      <a
        href="https://openlibrary.org"
        target="_blank"
        rel="noreferrer noopener"
        className="underline underline-offset-2 outline-none hover:text-foreground/70 focus-visible:ring-2 focus-visible:ring-accent"
      >
        Open Library
      </a>
      , a project of the Internet Archive.
    </p>
  );
}
