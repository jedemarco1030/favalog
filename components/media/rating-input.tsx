"use client";

import { Star } from "lucide-react";
import { useId, useState } from "react";
import { cn } from "@/lib/cn";

/** Every half-star value the diary accepts, in ascending order. */
const HALF_STEPS = [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5] as const;

interface RatingInputProps {
  /** Form field name submitted to the Server Action. */
  name?: string;
  /** Pre-selected rating, or `null` for "no rating". */
  defaultValue?: number | null;
  /** Wiring for a field label + error via `aria-describedby`. */
  describedBy?: string;
  invalid?: boolean;
  /** Ref target so the dialog can move focus here for the "Rate" entry. */
  autoFocusRef?: React.Ref<HTMLInputElement>;
}

/**
 * Keyboard-accessible half-star rating input.
 *
 * Implemented as a real `radiogroup` of native radios (one per half-star value,
 * plus a "No rating" option), so arrow-key navigation, focus, and form
 * submission all work natively — a value of `""` means unrated and maps to a
 * null rating server-side. The radios are visually presented as star chips; the
 * star glyphs are decorative and each radio carries an explicit accessible
 * name ("3.5 stars"), so assistive tech announces the value, not the icon.
 */
export function RatingInput({
  name = "rating",
  defaultValue = null,
  describedBy,
  invalid = false,
  autoFocusRef,
}: RatingInputProps) {
  const [value, setValue] = useState<string>(
    defaultValue == null ? "" : String(defaultValue),
  );
  const groupId = useId();

  return (
    <div
      role="radiogroup"
      aria-label="Your rating"
      aria-describedby={describedBy}
      aria-invalid={invalid || undefined}
      className="flex flex-wrap items-center gap-1.5"
    >
      <label
        className={cn(
          "inline-flex cursor-pointer items-center rounded-full border px-3 py-1 text-xs font-medium outline-none transition-colors focus-within:ring-2 focus-within:ring-accent",
          value === ""
            ? "border-border bg-surface-2 text-foreground"
            : "border-border/60 bg-surface-1 text-foreground/60 hover:text-foreground",
        )}
      >
        <input
          type="radio"
          name={name}
          value=""
          checked={value === ""}
          onChange={() => setValue("")}
          aria-label="No rating"
          className="sr-only"
        />
        No rating
      </label>

      {HALF_STEPS.map((step, index) => {
        const stepValue = String(step);
        const selected = value === stepValue;
        return (
          <label
            key={stepValue}
            className={cn(
              "inline-flex cursor-pointer items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium tabular-nums outline-none transition-colors focus-within:ring-2 focus-within:ring-accent",
              selected
                ? "border-accent/60 bg-accent/15 text-foreground"
                : "border-border/60 bg-surface-1 text-foreground/60 hover:text-foreground",
            )}
          >
            <input
              ref={index === 0 ? autoFocusRef : undefined}
              type="radio"
              name={name}
              value={stepValue}
              checked={selected}
              onChange={() => setValue(stepValue)}
              aria-label={`${step} ${step === 1 ? "star" : "stars"}`}
              id={index === 0 ? `${groupId}-first` : undefined}
              className="sr-only"
            />
            <Star
              className={cn(
                "size-3.5",
                selected ? "fill-current text-accent" : "text-foreground/40",
              )}
              strokeWidth={selected ? 0 : 1.5}
              aria-hidden="true"
            />
            {step.toFixed(1)}
          </label>
        );
      })}
    </div>
  );
}
