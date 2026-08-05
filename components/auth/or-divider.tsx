/** A subtle "or" separator between the credentials form and OAuth. */
export function OrDivider() {
  return (
    <div className="flex items-center gap-3" aria-hidden="true">
      <span className="h-px flex-1 bg-border/70" />
      <span className="text-xs uppercase tracking-wide text-foreground/40">
        or
      </span>
      <span className="h-px flex-1 bg-border/70" />
    </div>
  );
}
