import { cn } from "@/lib/cn";

interface LogoProps {
  className?: string;
  /** Render as a plain wordmark without the accent dot. */
  plain?: boolean;
}

/**
 * Lorely wordmark. Uses the display serif token from `--font-display`.
 * The trailing dot uses the accent color so the brand feels editorial,
 * not techy.
 */
export function Logo({ className, plain = false }: LogoProps) {
  return (
    <span
      className={cn(
        "font-display text-2xl leading-none tracking-tight text-foreground",
        className,
      )}
    >
      lorely
      {!plain && <span className="text-accent">.</span>}
    </span>
  );
}
