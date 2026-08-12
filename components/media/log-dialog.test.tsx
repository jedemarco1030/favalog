import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

// The dialog takes its action as a prop, so we can drive it deterministically
// with a local mock — no server-only module is imported.
const logTitleAction = vi.fn();

const push = vi.fn();
const refresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh }),
}));

import { LogDialog } from "@/components/media/log-dialog";
import type { Movie } from "@/lib/types";

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

function renderOpen(overrides: Partial<Parameters<typeof LogDialog>[0]> = {}) {
  const onClose = vi.fn();
  render(
    <LogDialog
      open
      onClose={onClose}
      focus="log"
      action={logTitleAction}
      item={movie}
      returnTo="/title/dune-part-two"
      defaultRevisit={false}
      {...overrides}
    />,
  );
  return { onClose };
}

describe("LogDialog", () => {
  beforeEach(() => {
    logTitleAction.mockReset();
    push.mockReset();
    refresh.mockReset();
  });

  it("renders accessible dialog fields when open", () => {
    renderOpen();
    const dialog = screen.getByRole("dialog", { name: /Log .Dune: Part Two./ });
    expect(dialog).toBeInTheDocument();
    expect(
      screen.getByRole("radiogroup", { name: "Your rating" }),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText("Review title (optional)"),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Review (optional)")).toBeInTheDocument();
    expect(
      screen.getByRole("checkbox", { name: /contains spoilers/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("checkbox", { name: /Rewatch/ }),
    ).toBeInTheDocument();
  });

  it("moves focus to the review field for the Review entry point", async () => {
    renderOpen({ focus: "review" });
    await waitFor(() =>
      expect(screen.getByLabelText("Review (optional)")).toHaveFocus(),
    );
  });

  it("shows a field-linked validation error returned by the server", async () => {
    const user = userEvent.setup();
    logTitleAction.mockResolvedValue({
      status: "invalid",
      message: "Please fix the highlighted fields and try again.",
      fieldErrors: { reviewBody: "Keep your review shorter." },
    });
    renderOpen();

    await user.click(screen.getByRole("button", { name: "Save log" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Please fix the highlighted fields",
    );
    expect(screen.getByText("Keep your review shorter.")).toBeInTheDocument();
  });

  it("shows a safe server error without leaking raw details", async () => {
    const user = userEvent.setup();
    logTitleAction.mockResolvedValue({
      status: "error",
      message:
        "We couldn't save your log just now. Please try again in a moment.",
    });
    renderOpen();

    await user.click(screen.getByRole("button", { name: "Save log" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "We couldn't save your log",
    );
  });

  it("refreshes the route and closes on success", async () => {
    const user = userEvent.setup();
    logTitleAction.mockResolvedValue({
      status: "success",
      diaryEntryId: "d1",
      createdReview: false,
    });
    const { onClose } = renderOpen();

    await user.click(screen.getByRole("button", { name: "Save log" }));

    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(onClose).toHaveBeenCalled();
  });

  it("routes an expired session through the safe redirect", async () => {
    const user = userEvent.setup();
    logTitleAction.mockResolvedValue({
      status: "unauthenticated",
      redirectTo: "/auth/sign-in?returnTo=%2Ftitle%2Fdune-part-two",
    });
    renderOpen();

    await user.click(screen.getByRole("button", { name: "Save log" }));
    await waitFor(() =>
      expect(push).toHaveBeenCalledWith(
        "/auth/sign-in?returnTo=%2Ftitle%2Fdune-part-two",
      ),
    );
  });
});

describe("LogDialog (edit mode)", () => {
  const initialValues = {
    loggedAt: "2026-08-02T21:30:00.000Z",
    rating: 4 as number | null,
    isRevisit: true,
    reviewTitle: "My title",
    reviewBody: "My body.",
    containsSpoilers: true,
  };

  function renderEdit(
    overrides: Partial<Parameters<typeof LogDialog>[0]> = {},
  ) {
    const onClose = vi.fn();
    render(
      <LogDialog
        open
        onClose={onClose}
        focus="log"
        mode="edit"
        action={logTitleAction}
        diaryEntryId="11111111-1111-1111-1111-111111111111"
        item={movie}
        returnTo="/title/dune-part-two"
        defaultRevisit={false}
        initialValues={initialValues}
        {...overrides}
      />,
    );
    return { onClose };
  }

  beforeEach(() => {
    logTitleAction.mockReset();
    push.mockReset();
    refresh.mockReset();
  });

  it("distinguishes editing: 'Edit log' heading and 'Save changes' button", () => {
    renderEdit();
    expect(
      screen.getByRole("dialog", { name: /Edit log .Dune: Part Two./ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Save changes" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Save log" }),
    ).not.toBeInTheDocument();
  });

  it("pre-fills the existing entry values", () => {
    renderEdit();
    expect(screen.getByLabelText("Review title (optional)")).toHaveValue(
      "My title",
    );
    expect(screen.getByLabelText("Review (optional)")).toHaveValue("My body.");
    expect(
      screen.getByRole("checkbox", { name: /contains spoilers/i }),
    ).toBeChecked();
    expect(screen.getByRole("checkbox", { name: /Rewatch/ })).toBeChecked();
    expect(screen.getByRole("radio", { name: "4 stars" })).toBeChecked();
  });

  it("lets the rating be changed via the rating radios", async () => {
    const user = userEvent.setup();
    renderEdit();
    const five = screen.getByRole("radio", { name: "5 stars" });
    await user.click(five);
    expect(five).toBeChecked();
    expect(screen.getByRole("radio", { name: "4 stars" })).not.toBeChecked();
  });

  it("refreshes and closes on a successful edit", async () => {
    const user = userEvent.setup();
    logTitleAction.mockResolvedValue({
      status: "success",
      diaryEntryId: "11111111-1111-1111-1111-111111111111",
      createdReview: true,
    });
    const { onClose } = renderEdit();

    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(onClose).toHaveBeenCalled();
  });

  // Kept last: a never-resolving action leaves the form pending for the
  // duration of the test, so it must not precede tests that assert a settled
  // result.
  it("announces saving and disables controls while pending", async () => {
    const user = userEvent.setup();
    logTitleAction.mockReturnValue(new Promise<never>(() => {}));
    renderEdit();

    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Saving/ })).toBeDisabled(),
    );
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    expect(screen.getByText("Saving your changes…")).toBeInTheDocument();
  });
});
