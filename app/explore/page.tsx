import { Compass } from "lucide-react";
import type { Metadata } from "next";
import { Container } from "@/components/ui/container";
import { EmptyState } from "@/components/ui/empty-state";

export const metadata: Metadata = {
  title: "Explore",
  description:
    "Browse movies, TV, and books all in one place, and filter down to what you're in the mood for.",
};

/**
 * Lightweight placeholder for the future Explore surface. Full browsing
 * and the All / Movies / TV / Books filter land in a later pass — this
 * page exists so the primary nav never points at a dead route.
 */
export default function ExplorePage() {
  return (
    <Container className="py-16">
      <div className="max-w-2xl">
        <h1 className="font-display text-4xl tracking-tight text-foreground">
          Explore
        </h1>
        <p className="mt-3 text-foreground/70">
          One place to browse everything worth watching or reading —
          movies, TV, and books side by side.
        </p>
      </div>
      <EmptyState
        className="mt-10"
        icon={Compass}
        title="Filtering by movies, TV, and books is coming next."
        description="For now, take a look at what's featured on the home page."
      />
    </Container>
  );
}
