import "server-only";

import { materializeExternalTitleAction } from "@/app/explore/actions";
import { REQUEST_TIMEOUT_MS, MAX_SEARCH_RESULTS } from "@/lib/catalog/config";
import { CatalogProviderError } from "@/lib/catalog/errors";
import { buildExternalResultViews } from "@/lib/catalog/external-result-view-model";
import { createServerProviderRegistry } from "@/lib/catalog/provider-registry";
import type {
  CatalogKindFilter,
  CatalogSearchCandidate,
  ExternalProvider,
} from "@/lib/catalog/types";
import { resolveExternalRefs } from "@/lib/supabase/external-resolution";
import { ExternalResultCard } from "./external-result-card";
import { ProviderAttribution } from "./provider-attribution";

/** Restrained per-section result cap so a federated section stays a supplement. */
const SECTION_LIMIT = 6 as const;

interface ExternalResultsSectionProps {
  provider: ExternalProvider;
  /** Section heading, e.g. "More movies & TV" / "More books". */
  heading: string;
  /** The already-validated, non-empty query. */
  query: string;
  /** The kind filter to pass to the provider (a provider ignores kinds it lacks). */
  kind: CatalogKindFilter;
  /** Slugs already shown in the LOCAL results, to avoid duplicate representations. */
  localSlugs: readonly string[];
  isAuthenticated: boolean;
  signInHref: string;
  /** Safe same-origin path to return to after an import (the current Explore state). */
  returnTo: string;
}

/**
 * A streamed, provider-scoped "More from …" federated section (Catalog Platform
 * v1B).
 *
 * This async Server Component fetches ONE provider server-side, resolves each
 * candidate against canonical identity, drops anything already shown locally,
 * and renders the remainder as {@link ExternalResultCard}s. It is designed to be
 * wrapped in `<Suspense>` by the page so provider latency streams in AFTER the
 * local results and never blocks them.
 *
 * It FAILS SAFELY: a provider timeout/error, or a resolution read failure, never
 * throws to the page — it renders a small, controlled "couldn't load" note (or
 * nothing) so one provider failing can neither hide local results nor the other
 * provider. Providers are only ever called from here (server-side), never from
 * the browser, and never for an empty query (the page guards that upstream).
 */
export async function ExternalResultsSection({
  provider,
  heading,
  query,
  kind,
  localSlugs,
  isAuthenticated,
  signInHref,
  returnTo,
}: ExternalResultsSectionProps) {
  let candidates: CatalogSearchCandidate[];
  try {
    const registry = createServerProviderRegistry();
    const page = await registry.get(provider).search({
      query,
      kind,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    candidates = page.items.slice(0, MAX_SEARCH_RESULTS);
  } catch (error) {
    // A provider failure is isolated to this section.
    void (error instanceof CatalogProviderError ? error.category : "unknown");
    return (
      <SectionShell provider={provider} heading={heading}>
        <p className="text-sm text-foreground/50">
          More results from {providerLabel(provider)} aren&rsquo;t available
          right now.
        </p>
      </SectionShell>
    );
  }

  if (candidates.length === 0) {
    return null;
  }

  // Resolve each candidate to a canonical slug (exact identity only) so an
  // already-materialized/linked title links straight to its title page and is
  // never offered for import.
  const resolved = await resolveExternalRefs(
    provider,
    candidates.map((c) => ({ kind: c.kind, externalId: c.ref.externalId })),
  );

  const views = buildExternalResultViews(
    candidates,
    resolved,
    localSlugs,
    SECTION_LIMIT,
  );

  if (views.length === 0) {
    return null;
  }

  return (
    <SectionShell provider={provider} heading={heading}>
      <ul
        role="list"
        className="grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 lg:grid-cols-5"
      >
        {views.map((view) => (
          <li key={`${view.provider}:${view.kind}:${view.externalId}`}>
            <ExternalResultCard
              result={view}
              isAuthenticated={isAuthenticated}
              signInHref={signInHref}
              returnTo={returnTo}
              action={materializeExternalTitleAction}
            />
          </li>
        ))}
      </ul>
    </SectionShell>
  );
}

/** Consistent heading + attribution wrapper for a federated section. */
function SectionShell({
  provider,
  heading,
  children,
}: {
  provider: ExternalProvider;
  heading: string;
  children: React.ReactNode;
}) {
  return (
    <section aria-label={heading} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="font-display text-xl tracking-tight text-foreground">
          {heading}
        </h2>
        <p className="text-sm text-foreground/50">
          Not yet in Favalog — add one to start tracking it.
        </p>
      </div>
      {children}
      <ProviderAttribution provider={provider} />
    </section>
  );
}

function providerLabel(provider: ExternalProvider): string {
  return provider === "tmdb" ? "TMDB" : "Open Library";
}
