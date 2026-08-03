import { BookmarkPlus, Eye, PenLine, Star } from "lucide-react";
import type { ComponentType, ReactNode } from "react";
import type { LucideProps } from "lucide-react";
import type { MediaItem } from "@/lib/types";
import { cn } from "@/lib/cn";

interface MediaActionsProps {
  item: MediaItem;
  className?: string;
}

const LOG_LABELS: Record<MediaItem["kind"], string> = {
  movie: "Log",
  tv: "Log",
  book: "Log",
};

/**
 * Presentation-only action row for a title. These controls do NOT persist,
 * mutate, or fake any state — they exist so the design communicates the
 * shape of the future product (log, rate, review, list). Real logging,
 * rating submission, review creation, and list persistence are explicitly
 * out of scope for this milestone.
 */
export function MediaActions({ item, className }: MediaActionsProps) {
  return (
    <div
      role="group"
      aria-label={`Actions for ${item.title}`}
      className={cn("flex flex-wrap items-center gap-2", className)}
    >
      <ActionButton icon={Eye} label={LOG_LABELS[item.kind]} tone="primary" />
      <ActionButton icon={Star} label="Rate" />
      <ActionButton icon={PenLine} label="Review" />
      <ActionButton icon={BookmarkPlus} label="Add to list" />
    </div>
  );
}

interface ActionButtonProps {
  icon: ComponentType<LucideProps>;
  label: string;
  tone?: "primary" | "neutral";
}

function ActionButton({
  icon: Icon,
  label,
  tone = "neutral",
}: ActionButtonProps): ReactNode {
  return (
    <button
      type="button"
      // These buttons are intentionally non-persistent affordances until the
      // real product APIs land. `aria-disabled` communicates that to AT users
      // without hiding the control from tab order.
      aria-disabled="true"
      title={`${label} (coming soon)`}
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
        tone === "primary"
          ? "border-accent/40 bg-accent/10 text-accent hover:bg-accent/15"
          : "border-border/70 bg-surface-1 text-foreground/80 hover:border-border hover:text-foreground",
      )}
    >
      <Icon className="size-4" aria-hidden="true" />
      <span>{label}</span>
    </button>
  );
}
