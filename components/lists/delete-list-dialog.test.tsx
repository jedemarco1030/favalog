import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();
const refresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh }),
}));

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

  it("navigates to /lists on a successful deletion", async () => {
    const user = userEvent.setup();
    const { onClose, action } = renderOpen();
    action.mockResolvedValue({ status: "success" });

    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: "Delete list" }));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/lists"));
    expect(onClose).toHaveBeenCalled();
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
