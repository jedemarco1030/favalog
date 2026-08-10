import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock the Server Action boundary so this UI test never imports server-only
// modules; the action's real behavior is covered by its composed helpers.
const logTitleAction = vi.fn();
vi.mock("@/app/title/[slug]/actions", () => ({
  logTitleAction: (...args: unknown[]) => logTitleAction(...args),
}));

const push = vi.fn();
const refresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh }),
}));

import { MediaActions } from "@/components/media/media-actions";
import type { Movie } from "@/lib/types";
import type { PersonalTitleView } from "@/lib/supabase/diary";

const movie: Movie = {
  id: "m1",
  slug: "dune-part-two",
  kind: "movie",
  title: "Dune: Part Two",
  synopsis: "",
  year: 2024,
  posterUrl: "",
  genres: [],
  runtimeMinutes: 166,
  director: "Denis Villeneuve",
  cast: [],
};

const signInHref = "/auth/sign-in?returnTo=%2Ftitle%2Fdune-part-two";
const returnTo = "/title/dune-part-two";

describe("MediaActions", () => {
  beforeEach(() => {
    logTitleAction.mockReset();
    push.mockReset();
    refresh.mockReset();
  });

  it("sends a signed-out visitor's Log/Rate/Review to the safe sign-in flow", () => {
    render(
      <MediaActions
        item={movie}
        isAuthenticated={false}
        returnTo={returnTo}
        signInHref={signInHref}
        personal={null}
      />,
    );

    for (const name of ["Watched", "Rate", "Review"]) {
      const link = screen.getByRole("link", { name });
      expect(link).toHaveAttribute("href", signInHref);
    }
    // No dialog is rendered for a signed-out visitor.
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(
      screen.getByText(/free account to log, rate, and review/i),
    ).toBeInTheDocument();
  });

  it("keeps Add to list honestly unavailable", () => {
    render(
      <MediaActions
        item={movie}
        isAuthenticated
        returnTo={returnTo}
        signInHref={signInHref}
        personal={null}
      />,
    );
    const addToList = screen.getByRole("button", { name: "Add to list" });
    expect(addToList).toBeDisabled();
    expect(addToList).toHaveAttribute("aria-disabled", "true");
  });

  it("opens the logging dialog for a signed-in viewer", async () => {
    const user = userEvent.setup();
    render(
      <MediaActions
        item={movie}
        isAuthenticated
        returnTo={returnTo}
        signInHref={signInHref}
        personal={null}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Watched" }));
    expect(
      await screen.findByRole("dialog", { name: /Log .Dune: Part Two./ }),
    ).toBeInTheDocument();
  });

  it("shows the latest personal state and a 'Log again' affordance when already logged", () => {
    const personal: PersonalTitleView = {
      diaryEntryId: "d1",
      loggedAt: "2026-08-02T21:30:00.000Z",
      action: "watched",
      rating: 4.5,
      isRevisit: false,
      hasReview: false,
    };
    render(
      <MediaActions
        item={movie}
        isAuthenticated
        returnTo={returnTo}
        signInHref={signInHref}
        personal={personal}
      />,
    );

    expect(
      screen.getByRole("button", { name: "Log again" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Watched on/)).toBeInTheDocument();
  });
});
