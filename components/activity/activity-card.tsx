import Link from "next/link";
import type { ActivityItem, MediaItem, User } from "@/lib/types";
import { MediaPoster } from "@/components/media/media-poster";
import { UserAvatar } from "@/components/user/user-avatar";
import { StarRating } from "@/components/ui/star-rating";
import { cn } from "@/lib/cn";

interface ActivityCardProps {
  activity: ActivityItem;
  user: User;
  media: MediaItem;
  className?: string;
}

const KIND_VERB: Record<ActivityItem["kind"], string> = {
  rated: "rated",
  reviewed: "reviewed",
  listed: "added to a list",
  finished: "finished",
  started: "started",
};

const dateFormatter = new Intl.DateTimeFormat("en", {
  month: "short",
  day: "numeric",
});

/**
 * A single feed row: who did what to which title, with optional rating
 * and review excerpt. The media title links to `/title/[slug]`.
 */
export function ActivityCard({
  activity,
  user,
  media,
  className,
}: ActivityCardProps) {
  return (
    <article
      className={cn(
        "flex gap-4 rounded-xl border border-border/60 bg-surface-1 p-4 transition-colors hover:border-border",
        className,
      )}
    >
      <Link
        href={`/title/${media.slug}`}
        aria-label={`View ${media.title}`}
        className="shrink-0 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <MediaPoster
          item={media}
          sizes="80px"
          decorative
          className="size-16 rounded-md ring-0 sm:size-20"
        />
      </Link>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <p className="flex flex-wrap items-center gap-1.5 text-sm text-foreground/70">
          <UserAvatar user={user} size="sm" decorative />
          <span className="font-medium text-foreground">
            {user.displayName}
          </span>
          <span>{KIND_VERB[activity.kind]}</span>
          <Link
            href={`/title/${media.slug}`}
            className="font-medium text-foreground transition-colors hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            {media.title}
          </Link>
        </p>
        {activity.rating != null && <StarRating value={activity.rating} />}
        {activity.excerpt && (
          <p className="line-clamp-2 text-sm italic text-foreground/60">
            “{activity.excerpt}”
          </p>
        )}
        <time
          className="mt-1 text-xs text-foreground/40"
          dateTime={activity.createdAt}
        >
          {dateFormatter.format(new Date(activity.createdAt))}
        </time>
      </div>
    </article>
  );
}
