"use client";

import { useId, useState } from "react";
import { EyeOff } from "lucide-react";
import { cn } from "@/lib/cn";

interface SpoilerExcerptProps {
  /** The (already bounded) review excerpt. */
  excerpt: string;
  /** When true the text is concealed until the reader explicitly reveals it. */
  containsSpoilers: boolean;
  /** Used only for the reveal button's accessible name. */
  mediaTitle: string;
  className?: string;
}

/**
 * A review excerpt that genuinely conceals spoiler-marked writing.
 *
 * Until now `contains_spoilers` was stored and merely italicised, which is not
 * concealment at all. Here the text is simply NOT RENDERED until the reader
 * activates the reveal control, so it cannot be read by eye, by a screen
 * reader, or by selecting the page text. The control is a real `<button>` with
 * `aria-expanded`, so it is keyboard operable and announces its state.
 *
 * Once revealed it stays revealed for that card — hiding it again would fight
 * the reader rather than protect them.
 */
export function SpoilerExcerpt({
  excerpt,
  containsSpoilers,
  mediaTitle,
  className,
}: SpoilerExcerptProps) {
  const [revealed, setRevealed] = useState(false);
  const bodyId = useId();

  if (!containsSpoilers) {
    return (
      <p className={cn("text-sm text-foreground/70", className)}>
        &ldquo;{excerpt}&rdquo;
      </p>
    );
  }

  return (
    <div className={cn("flex flex-col items-start gap-2", className)}>
      <button
        type="button"
        aria-expanded={revealed}
        aria-controls={bodyId}
        onClick={() => setRevealed(true)}
        disabled={revealed}
        className={cn(
          "inline-flex items-center gap-2 rounded-full border border-border/70 bg-surface-2 px-3 py-1 text-xs font-medium text-foreground/70 outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent",
          revealed && "cursor-default opacity-70 hover:text-foreground/70",
        )}
      >
        <EyeOff className="size-3.5" aria-hidden="true" />
        {revealed ? "Spoilers shown" : `Show spoilers for ${mediaTitle}`}
      </button>
      <p id={bodyId} className="text-sm text-foreground/70">
        {revealed ? (
          <>&ldquo;{excerpt}&rdquo;</>
        ) : (
          <span className="text-foreground/50">
            This review contains spoilers.
          </span>
        )}
      </p>
    </div>
  );
}
