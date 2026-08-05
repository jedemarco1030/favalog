import Image from "next/image";
import { CalendarDays, MapPin } from "lucide-react";
import type { MediaItem, User } from "@/lib/types";
import { UserAvatar } from "@/components/user/user-avatar";
import { cn } from "@/lib/cn";

interface ProfileHeaderProps {
  user: User;
  /**
   * When true, render the presentation-only current-user action (Edit
   * profile). Editing is deliberately not implemented in this phase.
   */
  isCurrentUser?: boolean;
  /**
   * Optional artwork for the decorative cover collage behind the identity.
   * Purely visual and hidden from assistive tech.
   */
  coverMedia?: Pick<MediaItem, "id" | "posterUrl">[];
  className?: string;
}

const joinedFormatter = new Intl.DateTimeFormat("en", {
  month: "long",
  year: "numeric",
});

function formatCount(value: number): string {
  return value.toLocaleString("en-US");
}

/**
 * The profile hero: a decorative cover collage, the person's avatar, name,
 * @username, bio, location, join date, follower/following counts, and — for
 * the current viewer's own profile — a presentation-only Edit profile action.
 *
 * The person's name is the page's single `h1`. The cover collage is
 * `aria-hidden` so screen readers are not read a wall of duplicate artwork,
 * while the avatar keeps a meaningful alt. Follower/following counts are
 * spelled out ("followers", "following") so they are understandable without
 * relying on visual layout.
 */
export function ProfileHeader({
  user,
  isCurrentUser = false,
  coverMedia = [],
  className,
}: ProfileHeaderProps) {
  const covers = coverMedia.slice(0, 5);

  return (
    <header
      className={cn(
        "relative overflow-hidden rounded-2xl border border-border/60 bg-surface-1",
        className,
      )}
    >
      {covers.length > 0 && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-36 sm:h-44"
        >
          <div className="flex h-full">
            {covers.map((cover) => (
              <div key={cover.id} className="relative flex-1">
                <Image
                  src={cover.posterUrl}
                  alt=""
                  fill
                  sizes="20vw"
                  className="object-cover opacity-30"
                />
              </div>
            ))}
          </div>
          <div className="absolute inset-0 bg-gradient-to-t from-surface-1 via-surface-1/85 to-surface-1/40" />
        </div>
      )}

      <div className="relative px-5 pb-6 pt-24 sm:px-8 sm:pt-28">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
            <UserAvatar
              user={user}
              size="xl"
              className="shrink-0 ring-4 ring-surface-1"
            />
            <div className="flex flex-col gap-2">
              <div>
                <h1 className="font-display text-3xl tracking-tight text-foreground sm:text-4xl">
                  {user.displayName}
                </h1>
                <p className="text-sm text-foreground/50">@{user.username}</p>
              </div>

              {user.bio && (
                <p className="max-w-prose text-sm leading-relaxed text-foreground/75">
                  {user.bio}
                </p>
              )}

              <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-foreground/50">
                {user.location && (
                  <li className="inline-flex items-center gap-1">
                    <MapPin className="size-3.5" aria-hidden="true" />
                    {user.location}
                  </li>
                )}
                <li className="inline-flex items-center gap-1">
                  <CalendarDays className="size-3.5" aria-hidden="true" />
                  Joined{" "}
                  <time dateTime={user.joinedAt}>
                    {joinedFormatter.format(new Date(user.joinedAt))}
                  </time>
                </li>
              </ul>

              <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-foreground/60">
                <span>
                  <strong className="font-semibold text-foreground tabular-nums">
                    {formatCount(user.followerCount)}
                  </strong>{" "}
                  followers
                </span>
                <span>
                  <strong className="font-semibold text-foreground tabular-nums">
                    {formatCount(user.followingCount)}
                  </strong>{" "}
                  following
                </span>
              </p>
            </div>
          </div>

          {isCurrentUser && (
            <button
              type="button"
              className="inline-flex shrink-0 items-center justify-center self-start rounded-full border border-border/70 bg-surface-2 px-4 py-2 text-sm font-medium text-foreground/80 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent sm:self-auto"
            >
              Edit profile
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
