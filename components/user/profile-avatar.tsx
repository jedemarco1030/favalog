import Image from "next/image";
import { cn } from "@/lib/cn";

interface ProfileAvatarProps {
  displayName: string;
  /** Optional artwork; when absent, initials are shown instead. */
  avatarUrl?: string | null;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  /** Empty alt when the name is already shown adjacent to the avatar. */
  decorative?: boolean;
}

const SIZE_PX: Record<NonNullable<ProfileAvatarProps["size"]>, number> = {
  sm: 28,
  md: 36,
  lg: 56,
  xl: 96,
};

const SIZE_CLASS: Record<NonNullable<ProfileAvatarProps["size"]>, string> = {
  sm: "size-7 text-xs",
  md: "size-9 text-sm",
  lg: "size-14 text-lg",
  xl: "size-20 text-2xl sm:size-24",
};

/** First letters of up to two name words, e.g. "Jamie DeMarco" -> "JD". */
export function initialsOf(displayName: string): string {
  const parts = displayName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const letters = parts.slice(0, 2).map((p) => p[0]!.toUpperCase());
  return letters.join("");
}

/**
 * Circular avatar for a real (Supabase-backed) profile identity. Renders the
 * stored artwork when present, otherwise a calm initials monogram — so a
 * freshly-onboarded user without an uploaded avatar still gets a clean,
 * accessible identity instead of a broken image.
 */
export function ProfileAvatar({
  displayName,
  avatarUrl,
  size = "md",
  className,
  decorative = false,
}: ProfileAvatarProps) {
  const px = SIZE_PX[size];

  return (
    <span
      className={cn(
        "relative inline-flex items-center justify-center overflow-hidden rounded-full bg-surface-2 font-medium text-foreground/80 ring-1 ring-inset ring-border/60",
        SIZE_CLASS[size],
        className,
      )}
    >
      {avatarUrl ? (
        <Image
          src={avatarUrl}
          alt={decorative ? "" : `${displayName} avatar`}
          width={px}
          height={px}
          className="size-full object-cover"
        />
      ) : (
        <span aria-hidden={decorative ? "true" : undefined}>
          {initialsOf(displayName)}
        </span>
      )}
    </span>
  );
}
