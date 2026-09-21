import Link from "next/link";
import { ProfileAvatar } from "@/components/user/profile-avatar";
import { StarRating } from "@/components/ui/star-rating";
import { LikeButton, type LikeAction } from "@/components/likes/like-button";
import type { RealMediaReviewView } from "@/lib/supabase/reviews";
import { cn } from "@/lib/cn";

interface RealReviewCardProps {
  review: RealMediaReviewView;
  /** True when a real, onboarded viewer is signed in. */
  isAuthenticated: boolean;
  /** Safe, same-origin sign-in href (with returnTo) for signed-out visitors. */
  signInHref: string;
  /** Safe, same-origin returnTo path (this title route) for the auth cases. */
  returnTo: string;
  /** The injected set-like Server Action. */
  likeAction: LikeAction;
  className?: string;
}

const dateFormatter = new Intl.DateTimeFormat("en", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

/**
 * A single REAL (Supabase-backed) community review of a title, with an
 * accessible, persistent like control.
 *
 * The author identity links to their canonical profile; the rating is the
 * effective (diary-resolved) rating from the read layer; and the like count +
 * viewer bit are server truth passed straight into the injected `LikeButton`.
 * This card renders only real data — it is never used for the mock demo layer.
 */
export function RealReviewCard({
  review,
  isAuthenticated,
  signInHref,
  returnTo,
  likeAction,
  className,
}: RealReviewCardProps) {
  const likeLabel = review.title
    ? `${review.author.displayName}'s review "${review.title}"`
    : `${review.author.displayName}'s review`;

  return (
    <article
      className={cn(
        "flex flex-col gap-3 rounded-xl border border-border/60 bg-surface-1 p-5 transition-colors hover:border-border",
        className,
      )}
    >
      <header className="flex items-center gap-3">
        <ProfileAvatar
          displayName={review.author.displayName}
          avatarUrl={review.author.avatarUrl ?? undefined}
          size="sm"
          decorative
        />
        <div className="min-w-0">
          <Link
            href={`/profile/${review.author.username}`}
            className="truncate rounded text-sm font-medium text-foreground outline-none transition-colors hover:text-accent focus-visible:ring-2 focus-visible:ring-accent"
          >
            {review.author.displayName}
          </Link>
          <p className="text-xs text-foreground/50">
            <span>@{review.author.username}</span>
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

      <footer className="mt-1 flex items-center justify-end">
        <LikeButton
          targetType="review"
          targetId={review.id}
          label={likeLabel}
          initialLikeCount={review.likeCount}
          initialViewerHasLiked={review.viewerHasLiked}
          isAuthenticated={isAuthenticated}
          signInHref={signInHref}
          returnTo={returnTo}
          action={likeAction}
        />
      </footer>
    </article>
  );
}
