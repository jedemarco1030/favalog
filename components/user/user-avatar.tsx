import Image from "next/image";
import type { User } from "@/lib/types";
import { cn } from "@/lib/cn";

interface UserAvatarProps {
  user: Pick<User, "displayName" | "avatarUrl">;
  size?: "sm" | "md" | "lg";
  className?: string;
  /** Empty alt when the user's name is already shown next to the avatar. */
  decorative?: boolean;
}

const SIZE_PX: Record<NonNullable<UserAvatarProps["size"]>, number> = {
  sm: 28,
  md: 36,
  lg: 56,
};

const SIZE_CLASS: Record<NonNullable<UserAvatarProps["size"]>, string> = {
  sm: "size-7",
  md: "size-9",
  lg: "size-14",
};

/**
 * Circular user avatar. Uses a fixed pixel width so Next/Image can serve a
 * correctly sized asset; a decorative alt is used when the caller already
 * renders the user's name adjacent to the avatar.
 */
export function UserAvatar({
  user,
  size = "md",
  className,
  decorative = false,
}: UserAvatarProps) {
  const px = SIZE_PX[size];
  return (
    <span
      className={cn(
        "relative inline-block overflow-hidden rounded-full bg-surface-2 ring-1 ring-inset ring-border/60",
        SIZE_CLASS[size],
        className,
      )}
    >
      <Image
        src={user.avatarUrl}
        alt={decorative ? "" : `${user.displayName} avatar`}
        width={px}
        height={px}
        className="size-full object-cover"
      />
    </span>
  );
}
