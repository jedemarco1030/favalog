import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

// The dialog takes its action as a prop, so a local mock drives it — no
// server-only module is imported.
const deleteAction = vi.fn();

const push = vi.fn();
const refresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh }),
}));

import { DeleteLogDialog } from "@/components/media/delete-log-dialog";

function renderOpen(
  overrides: Partial<Parameters<typeof DeleteLogDialog>[0]> = {},
) {
  const onClose = vi.fn();
  render(
    <DeleteLogDialog
      open
      onClose={onClose}
      action={deleteAction}
      diaryEntryId="11111111-1111-1111-1111-111111111111"
      title="Dune: Part Two"
      loggedAt="2026-08-02T21:30:00.000Z"
      returnTo="/diary"
      {...overrides}
    />,
  );
  return { onClose };
}

describe("DeleteLogDialog", () => {
  beforeEach(() => {
    deleteAction.mockReset();
    // A benign default so a submit never yields an undefined action state
    // (the real Server Action always returns a DeleteFormState).
    deleteAction.mockResolvedValue({ status: "idle" });
    push.mockReset();
    refresh.mockReset();
  });

  it("names the title and logged date in an alert dialog", () => {
    renderOpen();
    const dialog = screen.getByRole("alertdialog", {
      name: /Delete this diary entry/i,
    });
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveTextContent("Dune: Part Two");
    // The formatted logged date is shown to disambiguate which log is removed.
    expect(dialog).toHaveTextContent(/Aug 2, 2026/);
  });

  it("does not delete on open — only after the explicit Delete click", async () => {
    const user = userEvent.setup();
    renderOpen();
    expect(deleteAction).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Delete entry" }));
    await waitFor(() => expect(deleteAction).toHaveBeenCalledTimes(1));
  });

  it("cancels without deleting", async () => {
    const user = userEvent.setup();
    const { onClose } = renderOpen();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onClose).toHaveBeenCalled();
    expect(deleteAction).not.toHaveBeenCalled();
  });

  it("shows a safe error without leaking raw detail", async () => {
    const user = userEvent.setup();
    deleteAction.mockResolvedValue({
      status: "error",
      message: "We couldn't delete that entry just now. Please try again.",
    });
    renderOpen();

    await user.click(screen.getByRole("button", { name: "Delete entry" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "We couldn't delete that entry",
    );
  });

  it("refreshes and closes on a successful delete", async () => {
    const user = userEvent.setup();
    deleteAction.mockResolvedValue({ status: "success" });
    const { onClose } = renderOpen();

    await user.click(screen.getByRole("button", { name: "Delete entry" }));
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(onClose).toHaveBeenCalled();
  });

  it("routes an expired session through the safe redirect", async () => {
    const user = userEvent.setup();
    deleteAction.mockResolvedValue({
      status: "unauthenticated",
      redirectTo: "/auth/sign-in?returnTo=%2Fdiary",
    });
    renderOpen();

    await user.click(screen.getByRole("button", { name: "Delete entry" }));
    await waitFor(() =>
      expect(push).toHaveBeenCalledWith("/auth/sign-in?returnTo=%2Fdiary"),
    );
  });

  // Kept last: a never-resolving action leaves the form pending for the
  // duration of the test, so it must not precede tests that assert a settled
  // result.
  it("announces deleting and disables the destructive button while pending", async () => {
    const user = userEvent.setup();
    deleteAction.mockReturnValue(new Promise<never>(() => {}));
    renderOpen();

    await user.click(screen.getByRole("button", { name: "Delete entry" }));

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Deleting/ })).toBeDisabled(),
    );
    expect(screen.getByText("Deleting your entry…")).toBeInTheDocument();
  });
});
