import type { ExternalProvider } from "@/lib/catalog/types";
import { ProviderAttribution } from "@/components/media/provider-attribution";

const ORDER: readonly ExternalProvider[] = ["tmdb", "openlibrary", "rawg"];

/** Required credits for every external provider whose data Home displayed. */
export function HomeSources({
  providers,
}: {
  providers: readonly ExternalProvider[];
}) {
  const shown = ORDER.filter((p) => providers.includes(p));
  if (shown.length === 0) return null;
  return (
    <footer
      aria-label="Catalog sources"
      className="flex flex-col gap-2 border-t border-border/60 pt-6"
    >
      {shown.map((provider) => (
        <ProviderAttribution key={provider} provider={provider} />
      ))}
    </footer>
  );
}
