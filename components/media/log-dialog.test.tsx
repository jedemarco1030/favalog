import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Drive the action deterministically without importing server-only modules.
const logTitleAction = vi.fn();
vi.mock("@/app/title/[slug]/actions", () => ({
  logTitleAction: (...args: unknown[]) => logTitleAction(...args),
}));

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
