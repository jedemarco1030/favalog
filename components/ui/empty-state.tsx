import type { ComponentType, ReactNode } from "react";
import type { LucideProps } from "lucide-react";
import { cn } from "@/lib/cn";

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: ComponentType<LucideProps>;
  /** Slot for a primary action, usually a link or button. */
  action?: ReactNode;
  className?: string;
}

/**
 * Neutral empty-state block used when a list has no content yet. Kept
 * intentionally quiet — no oversized illustrations or gradients.
 */
export function EmptyState({
  title,
  description,
  icon: Icon,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border/70 bg-surface-1/40 px-6 py-12 text-center",
        className,
      )}
    >
      {Icon && (
        <span className="flex size-10 items-center justify-center rounded-full bg-surface-2 text-foreground/60">
          <Icon className="size-5" aria-hidden="true" />
        </span>
      )}
      <div className="max-w-md">
        <p className="font-display text-lg text-foreground">{title}</p>
        {description && (
          <p className="mt-1 text-sm text-foreground/60">{description}</p>
        )}
      </div>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
