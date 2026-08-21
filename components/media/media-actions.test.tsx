import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock the Server Action boundary so this UI test never imports server-only
// modules; the action's real behavior is covered by its composed helpers.
const logTitleAction = vi.fn();
const setFavoriteAction = vi.fn();
vi.mock("@/app/title/[slug]/actions", () => ({
  logTitleAction: (...args: unknown[]) => logTitleAction(...args),
  setFavoriteAction: (...args: unknown[]) => setFavoriteAction(...args),
}));

// The edit/delete Server Actions are also server-only; mock them too so this
// UI test never imports a `"use server"` module.
const editDiaryEntryAction = vi.fn();
const deleteDiaryEntryAction = vi.fn();
vi.mock("@/app/diary/actions", () => ({
  editDiaryEntryAction: (...args: unknown[]) => editDiaryEntryAction(...args),
  deleteDiaryEntryAction: (...args: unknown[]) =>
    deleteDiaryEntryAction(...args),
}));

// The list Server Actions are also server-only (they import the server-only
// data layer); mock them so this UI test never imports a `"use server"` module.
const addListItemAction = vi.fn();
const removeListItemAction = vi.fn();
const createListAction = vi.fn();
vi.mock("@/app/lists/actions", () => ({
  addListItemAction: (...args: unknown[]) => addListItemAction(...args),
  removeListItemAction: (...args: unknown[]) => removeListItemAction(...args),
  createListAction: (...args: unknown[]) => createListAction(...args),
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

    for (const name of ["Log", "Rate", "Review", "Add to list", "Favorite"]) {
      const link = screen.getByRole("link", { name });
      expect(link).toHaveAttribute("href", signInHref);
    }
    // The primary action is the neutral "Log", never a personalized
    // "Watched"/"Read" that would imply the app knows a signed-out visitor's
    // viewing state.
    expect(
      screen.queryByRole("link", { name: "Watched" }),
    ).not.toBeInTheDocument();
    // No dialog is rendered for a signed-out visitor.
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(
      screen.getByText(
        /free account to log, rate, review, favorite titles, and add them to lists/i,
      ),
    ).toBeInTheDocument();
  });

  it("never renders personalized viewing state for a signed-out visitor", () => {
    render(
      <MediaActions
        item={movie}
        isAuthenticated={false}
        returnTo={returnTo}
        signInHref={signInHref}
        personal={null}
      />,
    );

    expect(screen.getByRole("link", { name: "Log" })).toBeInTheDocument();
    // A signed-out visitor sees a neutral Favorite sign-in link, never a
    // personalized "Favorited" toggle.
    expect(screen.getByRole("link", { name: "Favorite" })).toHaveAttribute(
      "href",
      signInHref,
    );
    expect(
      screen.queryByRole("button", { name: /from your favorites/i }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/Watched on/)).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Edit log/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Delete log/ }),
    ).not.toBeInTheDocument();
  });

  it("opens the Add-to-list dialog for a signed-in viewer", async () => {
    const user = userEvent.setup();
    render(
      <MediaActions
        item={movie}
        isAuthenticated
        returnTo={returnTo}
        signInHref={signInHref}
        personal={null}
        addToList={{ mediaKnown: true, lists: [] }}
      />,
    );

    const addToList = screen.getByRole("button", { name: "Add to list" });
    expect(addToList).toBeEnabled();

    await user.click(addToList);
    expect(
      await screen.findByRole("dialog", {
        name: /Add .Dune: Part Two. to a list/,
      }),
    ).toBeInTheDocument();
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

    await user.click(screen.getByRole("button", { name: "Log" }));
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
      reviewTitle: null,
      reviewBody: null,
      containsSpoilers: false,
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
    // Owner-only edit/delete controls are present for the entry's owner.
    expect(
      screen.getByRole("button", { name: "Edit log" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Delete log" }),
    ).toBeInTheDocument();
  });
});
