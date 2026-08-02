import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

interface BadgeProps {
  children: ReactNode;
  className?: string;
  tone?: "neutral" | "accent";
}

/**
 * Small pill-shaped label. Used for kind tags, genres, and metadata chips.
 */
export function Badge({ children, className, tone = "neutral" }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wide",
        tone === "neutral"
          ? "border-border/70 bg-surface-2 text-foreground/70"
          : "border-accent/30 bg-accent/10 text-accent",
        className,
      )}
    >
      {children}
    </span>
  );
}
