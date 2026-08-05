import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export type AuthMessageVariant = "error" | "success" | "info" | "pending";

interface AuthMessageProps {
  variant?: AuthMessageVariant;
  children: ReactNode;
  className?: string;
}

const VARIANT_CLASS: Record<AuthMessageVariant, string> = {
  error: "border-red-500/40 bg-red-500/10 text-red-200",
  success: "border-emerald-500/40 bg-emerald-500/10 text-emerald-200",
  info: "border-accent/40 bg-accent/10 text-foreground",
  pending: "border-accent/40 bg-accent/10 text-foreground",
};

/**
 * A single, reusable status banner for every auth surface — invalid
 * credentials, pending email confirmation, reset-request accepted, and so on —
 * so we don't spawn a page per tiny outcome.
 *
 * Accessibility: errors use `role="alert"` (assertive) so a submission failure
 * is announced immediately without moving focus; non-error outcomes use a
 * polite live region. The message text is always provided by the server as a
 * safe, validated string — never a raw error dump or an unvalidated query
 * param.
 */
export function AuthMessage({
  variant = "info",
  children,
  className,
}: AuthMessageProps) {
  const isError = variant === "error";
  return (
    <div
      role={isError ? "alert" : "status"}
      aria-live={isError ? "assertive" : "polite"}
      className={cn(
        "rounded-lg border px-4 py-3 text-sm",
        VARIANT_CLASS[variant],
        className,
      )}
    >
      {children}
    </div>
  );
}
