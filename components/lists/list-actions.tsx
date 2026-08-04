"use client";

import { Check, Heart, Share2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { likeCountLabel } from "@/components/lists/list-view";
import { cn } from "@/lib/cn";

interface ListActionsProps {
  /** Baseline like count from the data layer; the like toggle is local-only. */
  likeCount: number;
  className?: string;
}

/**
 * Presentation-only Like / Share controls for a list.
 *
 * There is no persistence yet: the like toggle only reflects an optimistic,
 * in-memory state that resets on reload, and Share copies the current URL to
 * the clipboard (a browser API — not an external sharing integration) and
 * shows a transient confirmation. Both communicate the shape of the future
 * product without faking a backend.
 */
export function ListActions({ likeCount, className }: ListActionsProps) {
  const [liked, setLiked] = useState(false);
  const [copied, setCopied] = useState(false);
  const copyResetRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (copyResetRef.current !== null) {
        window.clearTimeout(copyResetRef.current);
      }
    };
  }, []);

  const displayCount = likeCount + (liked ? 1 : 0);

  const onShare = useCallback(() => {
    try {
      void navigator.clipboard?.writeText(window.location.href);
    } catch {
      // Clipboard access can be blocked; the confirmation is best-effort.
    }
    setCopied(true);
    if (copyResetRef.current !== null) {
      window.clearTimeout(copyResetRef.current);
    }
    copyResetRef.current = window.setTimeout(() => setCopied(false), 2000);
  }, []);

  return (
    <div className={cn("flex flex-wrap items-center gap-3", className)}>
      <button
        type="button"
        aria-pressed={liked}
        aria-label={liked ? "Unlike this list" : "Like this list"}
        onClick={() => setLiked((value) => !value)}
        className={cn(
          "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent",
          liked
            ? "border-accent/40 bg-accent/10 text-accent"
            : "border-border/70 bg-surface-1 text-foreground/80 hover:border-border hover:text-foreground",
        )}
      >
        <Heart
          className={cn("size-4", liked && "fill-current")}
          aria-hidden="true"
        />
        <span className="tabular-nums">{likeCountLabel(displayCount)}</span>
      </button>

      <button
        type="button"
        aria-label="Share this list"
        onClick={onShare}
        className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-surface-1 px-4 py-2 text-sm font-medium text-foreground/80 outline-none transition-colors hover:border-border hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent"
      >
        {copied ? (
          <Check className="size-4 text-accent" aria-hidden="true" />
        ) : (
          <Share2 className="size-4" aria-hidden="true" />
        )}
        {copied ? "Link copied" : "Share"}
      </button>

      <span aria-live="polite" className="sr-only">
        {copied ? "Link copied to clipboard" : ""}
      </span>
    </div>
  );
}
