import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

interface AuthFieldProps {
  id: string;
  name: string;
  label: string;
  type?: string;
  autoComplete?: string;
  required?: boolean;
  defaultValue?: string;
  /** Server-provided, per-field validation error. */
  error?: string;
  /** Optional static helper text (e.g. password requirements). */
  hint?: ReactNode;
  placeholder?: string;
  /** Render a multiline `<textarea>` instead of an `<input>`. */
  multiline?: boolean;
  rows?: number;
  autoFocus?: boolean;
  inputMode?: "text" | "email";
}

/**
 * Accessible labelled field for the auth forms.
 *
 * Every input has a real visible `<label>`, correct `autocomplete`/`type`, and
 * associates its hint and error through `aria-describedby` + `aria-invalid` so
 * assistive tech announces the problem. Errors render inline beneath the field
 * (focus is never stolen), which keeps server-validation errors keyboard- and
 * screen-reader-friendly.
 */
export function AuthField({
  id,
  name,
  label,
  type = "text",
  autoComplete,
  required,
  defaultValue,
  error,
  hint,
  placeholder,
  multiline = false,
  rows = 3,
  autoFocus,
  inputMode,
}: AuthFieldProps) {
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const describedBy =
    [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(" ") ||
    undefined;

  const controlClass = cn(
    "w-full rounded-lg border bg-surface-1 px-3 py-2 text-sm text-foreground placeholder:text-foreground/35 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent",
    error ? "border-red-500/60" : "border-border/70",
  );

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-foreground/80">
        {label}
      </label>

      {multiline ? (
        <textarea
          id={id}
          name={name}
          required={required}
          defaultValue={defaultValue}
          placeholder={placeholder}
          rows={rows}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cn(controlClass, "resize-y")}
        />
      ) : (
        <input
          id={id}
          name={name}
          type={type}
          autoComplete={autoComplete}
          required={required}
          defaultValue={defaultValue}
          placeholder={placeholder}
          inputMode={inputMode}
          autoFocus={autoFocus}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={controlClass}
        />
      )}

      {hint && (
        <p id={hintId} className="text-xs text-foreground/50">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-xs text-red-300">
          {error}
        </p>
      )}
    </div>
  );
}
