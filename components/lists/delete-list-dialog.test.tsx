import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();
const refresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh }),
}));

// NOTE: successful-deletion navigation is NOT a client concern. The real
// delete Server Action calls `redirect("/lists")` after revalidation (proven
// in `app/lists/actions.test.ts`). This suite must therefore never assert that
// a mocked `router.push` stands in for that real success flow; it only covers
// what the dialog genuinely owns: the auth / onboarding client redirects, the
// deliberate confirmation, and the pending lock.

import { DeleteListDialog } from "@/components/lists/delete-list-dialog";
import type { DeleteListFormState } from "@/app/lists/list-form";

function renderOpen(
  overrides: Partial<Parameters<typeof DeleteListDialog>[0]> = {},
) {
  const onClose = vi.fn();
  const action = vi.fn(async (): Promise<DeleteListFormState> => ({
    status: "idle",
  }));
  render(
    <DeleteListDialog
      open
      onClose={onClose}
      listId="11111111-1111-1111-1111-111111111111"
      listTitle="Favorite Sci-Fi"
      returnTo="/list/favorite-sci-fi"
      action={action}
      {...overrides}
    />,
  );
  return { onClose, action };
}

describe("DeleteListDialog", () => {
  beforeEach(() => {
    push.mockReset();
    refresh.mockReset();
  });

  it("names the list in an alert dialog", () => {
    renderOpen();
    const dialog = screen.getByRole("alertdialog", {
      name: /Delete this list/i,
    });
    expect(dialog).toHaveTextContent("Favorite Sci-Fi");
  });

  it("requires a deliberate confirmation before the delete is enabled", async () => {
    const user = userEvent.setup();
    const { action } = renderOpen();

    // The destructive button is disabled until the naming checkbox is ticked.
    expect(screen.getByRole("button", { name: "Delete list" })).toBeDisabled();
    expect(action).not.toHaveBeenCalled();

    await user.click(screen.getByRole("checkbox"));
    expect(screen.getByRole("button", { name: "Delete list" })).toBeEnabled();
  });

  it("leaves successful-deletion navigation to the Server Action (no client push)", async () => {
    const user = userEvent.setup();
    const { action } = renderOpen();
    // The real Server Action redirects to `/lists` itself and never resolves a
    // success state back to the client. Even if a success state were returned,
    // the dialog must NOT re-navigate on the client — that fragile effect is
    // exactly what this fix removed.
    action.mockResolvedValue({ status: "success" });

    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: "Delete list" }));

    await waitFor(() => expect(action).toHaveBeenCalled());
    expect(push).not.toHaveBeenCalled();
  });

  it("routes an unauthenticated result through the safe sign-in redirect", async () => {
    const user = userEvent.setup();
    const { action } = renderOpen();
    action.mockResolvedValue({
      status: "unauthenticated",
      redirectTo: "/auth/sign-in?returnTo=%2Flist%2Ffavorite-sci-fi",
    });

    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: "Delete list" }));

    await waitFor(() =>
      expect(push).toHaveBeenCalledWith(
        "/auth/sign-in?returnTo=%2Flist%2Ffavorite-sci-fi",
      ),
    );
  });

  // Kept last: a never-resolving action leaves the form pending.
  it("cannot be dismissed while the deletion is pending", async () => {
    const user = userEvent.setup();
    const { action } = renderOpen();
    action.mockReturnValue(new Promise<never>(() => {}));

    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: "Delete list" }));

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Deleting/ })).toBeDisabled(),
    );
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
  });
});
