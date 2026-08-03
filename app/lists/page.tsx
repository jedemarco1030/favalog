import { ListChecks } from "lucide-react";
import type { Metadata } from "next";
import { Container } from "@/components/ui/container";
import { EmptyState } from "@/components/ui/empty-state";

export const metadata: Metadata = {
  title: "Lists",
  description:
    "Build ranked and unranked lists across movies, TV, and books, and share them.",
};

/**
 * Lightweight placeholder for the future lists surface.
 */
export default function ListsPage() {
  return (
    <Container className="py-16">
      <div className="max-w-2xl">
        <h1 className="font-display text-4xl tracking-tight text-foreground">
          Lists
        </h1>
        <p className="mt-3 text-foreground/70">
          Ranked favorites, watchlists, shelves — build them across movies, TV,
          and books, and share them with people who get it.
        </p>
      </div>
      <EmptyState
        className="mt-10"
        icon={ListChecks}
        title="Building and sharing lists is coming next."
        description="This is where your favorites will live."
      />
    </Container>
  );
}
