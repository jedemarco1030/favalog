import Image from "next/image";
import type { ActivityItem, MediaItem, User } from "@/lib/types";
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
  listed: "added",
  finished: "finished",
  started: "started",
};

const dateFormatter = new Intl.DateTimeFormat("en", {
  month: "short",
  day: "numeric",
});

/**
 * A single feed row. Renders who did what to which title, plus optional
 * rating and review excerpt.
 */
export function ActivityCard({ activity, user, media, className }: ActivityCardProps) {
  return (
    <article
      className={cn(
        "flex gap-4 rounded-xl border border-border/60 bg-surface-1 p-4 transition-colors hover:border-border",
        className,
      )}
    >
      <div className="relative size-16 shrink-0 overflow-hidden rounded-md bg-surface-2 sm:size-20">
        <Image
          src={media.posterUrl}
          alt=""
          fill
          sizes="80px"
          className="object-cover"
        />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <p className="text-sm text-foreground/70">
          <span className="font-medium text-foreground">{user.displayName}</span>{" "}
          <span>{KIND_VERB[activity.kind]}</span>{" "}
          <span className="font-medium text-foreground">{media.title}</span>
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
