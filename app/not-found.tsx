import Link from "next/link";
import type { Metadata } from "next";
import { Compass } from "lucide-react";
import { Container } from "@/components/ui/container";

export const metadata: Metadata = {
  title: "Page not found",
  description: "This corner of Favalog is either gone or was never here.",
};

/**
 * Site-wide 404. Reached both by unmatched routes and by any page that
 * calls `notFound()` — most importantly `/title/[slug]` when a slug does
 * not resolve to a real `MediaItem`.
 */
export default function NotFound() {
  return (
    <Container className="flex min-h-[60vh] items-center py-20">
      <div className="mx-auto flex max-w-lg flex-col items-start gap-6">
        <span
          aria-hidden="true"
          className="text-[10px] font-medium uppercase tracking-[0.2em] text-accent"
        >
          404 · Not found
        </span>
        <h1 className="font-display text-4xl leading-tight tracking-tight text-foreground sm:text-5xl">
          We couldn&rsquo;t find that page.
        </h1>
        <p className="text-base text-foreground/70">
          The title, list, or profile you&rsquo;re looking for may have moved,
          been renamed, or never existed. From here you can head back to
          discovery.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/explore"
            className="inline-flex items-center gap-2 rounded-full border border-accent/40 bg-accent/10 px-4 py-2 text-sm font-medium text-accent transition-colors hover:bg-accent/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <Compass className="size-4" aria-hidden="true" />
            Go to Explore
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-surface-1 px-4 py-2 text-sm font-medium text-foreground/80 transition-colors hover:border-border hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            Back to home
          </Link>
        </div>
      </div>
    </Container>
  );
}
