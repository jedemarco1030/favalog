import Link from "next/link";
import { MediaPoster } from "@/components/media/media-poster";
import { MediaTypeBadge } from "@/components/media/media-type-badge";
import { ProfileAvatar } from "@/components/user/profile-avatar";
import { StarRating } from "@/components/ui/star-rating";
import { SpoilerExcerpt } from "@/components/feed/spoiler-excerpt";
import type {
  FeedAction,
  FeedActivityView,
} from "@/lib/supabase/feed-view-model";
import { cn } from "@/lib/cn";

interface FeedCardProps {
  item: FeedActivityView;
  className?: string;
}

/** Source-backed wording only — never an inferred "started"/"finished". */
const ACTION_VERB: Record<FeedAction, string> = {
  watched: "watched",
  rewatched: "rewatched",
  read: "read",
  reread: "reread",
  reviewed: "reviewed",
};

const dateFormatter = new Intl.DateTimeFormat("en", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

function formatDate(value: string): string {
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? "" : dateFormatter.format(new Date(ms));
}

/**
 * One combined activity item in the following feed: who did what, to which
 * title, with the rating they gave and the excerpt of the review they wrote.
 *
 * A diary entry and its linked review are ONE card (the deduplication already
 * happened in SQL), so a single action never appears as three rows.
 *
 * Link safety: three separate SIBLING links — the actor's canonical profile,
 * the canonical title, and (only when a review exists) the actor's public
 * reviews section, which is a destination that really renders that review.
 * There are no nested anchors, no dead controls, and never a link into another
 * user's private diary.
 */
export function FeedCard({ item, className }: FeedCardProps) {
  const { actor, media, review } = item;
  const createdLabel = formatDate(item.createdAt);
  const loggedLabel = item.loggedAt ? formatDate(item.loggedAt) : "";

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
        className="w-16 shrink-0 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-accent sm:w-20"
      >
        {/* A catalog row can legitimately have no artwork; a neutral frame is
            shown rather than a broken image. */}
        {media.posterUrl ? (
          <MediaPoster item={media} sizes="80px" decorative />
        ) : (
          <span
            aria-hidden="true"
            className="block aspect-[2/3] w-full rounded-lg bg-surface-2 ring-1 ring-inset ring-border/60"
          />
        )}
      </Link>

      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm text-foreground/70">
          <ProfileAvatar
            displayName={actor.displayName}
            avatarUrl={actor.avatarUrl}
            size="sm"
            decorative
          />
          <Link
            href={`/profile/${actor.username}`}
            className="rounded font-medium text-foreground outline-none transition-colors hover:text-accent focus-visible:ring-2 focus-visible:ring-accent"
          >
            {actor.displayName}
          </Link>
          <span>{ACTION_VERB[item.action]}</span>
          <Link
            href={`/title/${media.slug}`}
            className="rounded font-medium text-foreground outline-none transition-colors hover:text-accent focus-visible:ring-2 focus-visible:ring-accent"
          >
            {media.title}
          </Link>
          <MediaTypeBadge kind={media.kind} />
        </p>

        {item.rating != null && <StarRating value={item.rating} showNumeric />}

        {review && (
          <div className="flex flex-col gap-1.5">
            {review.title && (
              <h3 className="font-display text-base leading-snug text-foreground">
                {review.title}
              </h3>
            )}
            <SpoilerExcerpt
              excerpt={review.excerpt}
              containsSpoilers={review.containsSpoilers}
              mediaTitle={media.title}
            />
            <Link
              href={`/profile/${actor.username}#reviews`}
              className="self-start rounded text-xs font-medium text-accent underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-accent"
            >
              Read {actor.displayName}&rsquo;s reviews
            </Link>
          </div>
        )}

        <p className="mt-1 text-xs text-foreground/40">
          <time dateTime={item.createdAt}>{createdLabel}</time>
          {/* Only shown when the entry was genuinely backdated. */}
          {item.loggedAt && (
            <>
              {" · logged for "}
              <time dateTime={item.loggedAt}>{loggedLabel}</time>
            </>
          )}
        </p>
      </div>
    </article>
  );
}
