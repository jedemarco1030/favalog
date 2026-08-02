import Link from "next/link";
import type { MediaItem, Review, User } from "@/lib/types";
import { UserAvatar } from "@/components/user/user-avatar";
import { StarRating } from "@/components/ui/star-rating";
import { MediaTypeBadge } from "@/components/media/media-type-badge";
import { cn } from "@/lib/cn";

interface ReviewCardProps {
  review: Review;
  user: User;
  media: MediaItem;
  className?: string;
}

const dateFormatter = new Intl.DateTimeFormat("en", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

/**
 * A single review, laid out as a small editorial block: user, rating,
 * optional title, body, and a subtle link back to the reviewed title.
 */
export function ReviewCard({ review, user, media, className }: ReviewCardProps) {
  return (
    <article
      className={cn(
        "flex flex-col gap-3 rounded-xl border border-border/60 bg-surface-1 p-5 transition-colors hover:border-border",
        className,
      )}
    >
      <header className="flex items-center gap-3">
        <UserAvatar user={user} size="sm" decorative />
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">
            {user.displayName}
          </p>
          <p className="text-xs text-foreground/50">
            <span>@{user.handle}</span>
            <span aria-hidden="true"> · </span>
            <time dateTime={review.createdAt}>
              {dateFormatter.format(new Date(review.createdAt))}
            </time>
          </p>
        </div>
        {review.rating != null && (
          <span className="ml-auto">
            <StarRating value={review.rating} showNumeric />
          </span>
        )}
      </header>

      {review.title && (
        <h3 className="font-display text-lg leading-snug text-foreground">
          {review.title}
        </h3>
      )}
      <p
        className={cn(
          "text-sm text-foreground/75",
          review.containsSpoilers && "italic",
        )}
      >
        {review.body}
      </p>

      <footer className="mt-1 flex items-center justify-between gap-3 text-xs text-foreground/50">
        <Link
          href={`/title/${media.slug}`}
          className="inline-flex items-center gap-2 rounded transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <MediaTypeBadge kind={media.kind} />
          <span className="truncate">{media.title}</span>
        </Link>
        <span>{review.likeCount} likes</span>
      </footer>
    </article>
  );
}
