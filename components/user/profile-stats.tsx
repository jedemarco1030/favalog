import { cn } from "@/lib/cn";

export interface ProfileStat {
  label: string;
  /** Prefer a preformatted string (e.g. "1.2k") to keep number formatting consistent. */
  value: string | number;
}

interface ProfileStatsProps {
  stats: ProfileStat[];
  className?: string;
  /** Optional accessible label for the surrounding list. */
  label?: string;
}

/**
 * Horizontal band of labeled counters for profile pages. Uses a semantic
 * definition list so screen readers can pair each label with its value.
 */
export function ProfileStats({
  stats,
  className,
  label = "Profile statistics",
}: ProfileStatsProps) {
  return (
    <dl
      aria-label={label}
      className={cn(
        "flex flex-wrap items-center gap-x-8 gap-y-3",
        className,
      )}
    >
      {stats.map((stat) => (
        <div key={stat.label} className="flex flex-col">
          <dt className="text-[11px] uppercase tracking-wide text-foreground/50">
            {stat.label}
          </dt>
          <dd className="font-display text-2xl leading-none tracking-tight text-foreground tabular-nums">
            {stat.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
