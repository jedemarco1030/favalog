"use client";

import { Check, Share2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";

interface ShareListButtonProps {
  className?: string;
}

/**
 * Share control for a real list.
 *
 * Copies the current URL to the clipboard (a browser API, not an external
 * sharing integration) and shows a transient confirmation. Real lists show
 * only Share — deliberately no like toggle, since list likes aren't persisted
 * this phase and a fake zero-like counter would misrepresent the product.
 */
export function ShareListButton({ className }: ShareListButtonProps) {
  const [copied, setCopied] = useState(false);
  const resetRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (resetRef.current !== null) window.clearTimeout(resetRef.current);
    };
  }, []);

  const onShare = useCallback(() => {
    try {
      void navigator.clipboard?.writeText(window.location.href);
    } catch {
      // Clipboard access can be blocked; the confirmation is best-effort.
    }
    setCopied(true);
    if (resetRef.current !== null) window.clearTimeout(resetRef.current);
    resetRef.current = window.setTimeout(() => setCopied(false), 2000);
  }, []);

  return (
    <div className={cn("flex flex-wrap items-center gap-3", className)}>
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
