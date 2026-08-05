import { CalendarDays, MapPin, Sparkles } from "lucide-react";
import { Container } from "@/components/ui/container";
import { EmptyState } from "@/components/ui/empty-state";
import { ProfileSection } from "@/components/user/profile-section";
import { ProfileAvatar } from "@/components/user/profile-avatar";
import type { Profile } from "@/lib/types";

const joinedFormatter = new Intl.DateTimeFormat("en", {
  month: "long",
  year: "numeric",
});

interface RealProfileIdentityProps {
  profile: Profile;
  /** True when this is the signed-in viewer's own profile. */
  isCurrentUser?: boolean;
}

/**
 * Minimal, real (Supabase-backed) profile identity used during the transitional
 * phase.
 *
 * The main product still renders from the `@/lib/data` mock layer; this view is
 * shown only for a username that resolves to a REAL profile row and is not a
 * mock demo user. It renders the stored identity (name, @handle, bio, location,
 * join date) and honest empty states for the backend-backed sections that have
 * not been migrated yet — so a newly-registered user is NEVER attributed a mock
 * user's diary, reviews, or lists.
 */
export function RealProfileIdentity({
  profile,
  isCurrentUser = false,
}: RealProfileIdentityProps) {
  return (
    <Container className="flex flex-col gap-12 py-8 sm:gap-14 sm:py-10">
      <header className="relative overflow-hidden rounded-2xl border border-border/60 bg-surface-1 px-5 py-8 sm:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <ProfileAvatar
            displayName={profile.displayName}
            avatarUrl={profile.avatarUrl}
            size="xl"
            className="shrink-0 ring-4 ring-surface-1"
          />
          <div className="flex flex-col gap-2">
            <div>
              <h1 className="font-display text-3xl tracking-tight text-foreground sm:text-4xl">
                {profile.displayName}
              </h1>
              <p className="text-sm text-foreground/50">@{profile.username}</p>
            </div>

            {profile.bio && (
              <p className="max-w-prose text-sm leading-relaxed text-foreground/75">
                {profile.bio}
              </p>
            )}

            <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-foreground/50">
              {profile.location && (
                <li className="inline-flex items-center gap-1">
                  <MapPin className="size-3.5" aria-hidden="true" />
                  {profile.location}
                </li>
              )}
              <li className="inline-flex items-center gap-1">
                <CalendarDays className="size-3.5" aria-hidden="true" />
                Joined{" "}
                <time dateTime={profile.createdAt}>
                  {joinedFormatter.format(new Date(profile.createdAt))}
                </time>
              </li>
            </ul>
          </div>
        </div>
      </header>

      <ProfileSection
        title="Activity"
        description="Diary, reviews, lists, and favorites will appear here."
      >
        <EmptyState
          icon={Sparkles}
          title={
            isCurrentUser
              ? "Your Favalog is just getting started."
              : `${profile.displayName} is just getting started.`
          }
          description="Tracking movies, TV, and books isn't wired up to accounts yet — check back soon."
        />
      </ProfileSection>
    </Container>
  );
}
