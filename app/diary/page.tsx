import { NotebookPen } from "lucide-react";
import type { Metadata } from "next";
import { Container } from "@/components/ui/container";
import { EmptyState } from "@/components/ui/empty-state";

export const metadata: Metadata = {
  title: "Diary",
  description:
    "A running log of everything you've watched and read, in the order you got to it.",
};

/**
 * Lightweight placeholder for the future personal diary/log surface.
 */
export default function DiaryPage() {
  return (
    <Container className="py-16">
      <div className="max-w-2xl">
        <h1 className="font-display text-4xl tracking-tight text-foreground">
          Diary
        </h1>
        <p className="mt-3 text-foreground/70">
          A running log of everything you watch and read — when you got
          to it, what you rated it, what you thought.
        </p>
      </div>
      <EmptyState
        className="mt-10"
        icon={NotebookPen}
        title="Your diary is coming next."
        description="Logging what you finish, one entry at a time, is on its way."
      />
    </Container>
  );
}
