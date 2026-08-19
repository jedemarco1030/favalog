"use client";

import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";

interface SubmitButtonProps {
  children: React.ReactNode;
  /** Label announced/shown while the action is pending. */
  pendingLabel?: string;
  className?: string;
  variant?: "primary" | "secondary";
  /** Extra disabled condition, OR-ed with the form's pending state. */
  disabled?: boolean;
}

/**
 * Submit button that reflects the enclosing form's pending state via
 * `useFormStatus`, so every auth form gets a consistent disabled + spinner
 * treatment while a Server Action runs. `aria-disabled` and the visually
 * hidden pending label keep the state perceivable to assistive tech.
 */
export function SubmitButton({
  children,
  pendingLabel = "Working…",
  className,
  variant = "primary",
  disabled = false,
}: SubmitButtonProps) {
  const { pending } = useFormStatus();
  const isDisabled = pending || disabled;

  return (
    <button
      type="submit"
      disabled={isDisabled}
      aria-disabled={isDisabled}
      className={cn(
        "inline-flex h-10 items-center justify-center gap-2 rounded-lg px-4 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-60",
        variant === "primary"
          ? "bg-accent text-accent-foreground hover:bg-accent-strong"
          : "border border-border/70 bg-surface-1 text-foreground hover:bg-surface-2",
        className,
      )}
    >
      {pending && (
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
      )}
      {pending ? pendingLabel : children}
    </button>
  );
}
