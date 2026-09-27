import { SectionHeader } from "@/components/ui/section-header";
import type { DiscoveryCandidate } from "@/lib/discovery/types";
import { DiscoveryCard, type DiscoveryCardContext } from "./discovery-card";

interface DiscoveryShelfProps extends DiscoveryCardContext {
  id: string;
  title: string;
  /** What the ordering means, in plain words. Always shown. */
  description: string;
  candidates: DiscoveryCandidate[];
  href?: string;
  linkLabel?: string;
  showDate?: boolean;
  showKind?: boolean;
}

/** A labelled row of provider titles. Renders nothing when empty. */
export function DiscoveryShelf({
  id,
  title,
  description,
  candidates,
  href,
  linkLabel,
  showDate,
  showKind,
  ...context
}: DiscoveryShelfProps) {
  if (candidates.length === 0) return null;
  const allLandscape = candidates.every((c) => c.kind === "game");

  return (
    <section aria-label={title} data-shelf={id}>
      <SectionHeader
        title={title}
        description={description}
        href={href}
        linkLabel={linkLabel}
        as="h2"
      />
      <ul
        role="list"
        className={
          allLandscape
            ? "grid grid-cols-1 gap-x-5 gap-y-8 sm:grid-cols-2 lg:grid-cols-3"
            : "grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 lg:grid-cols-5"
        }
      >
        {candidates.map((candidate) => (
          <li
            key={`${candidate.ref.provider}:${candidate.ref.kind}:${candidate.ref.externalId}`}
          >
            <DiscoveryCard
              candidate={candidate}
              showDate={showDate}
              showKind={showKind}
              {...context}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
