import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();
const refresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh }),
}));

import { RemoveListItemDialog } from "@/components/lists/remove-list-item-dialog";
import type { ListItemFormState } from "@/app/lists/list-form";

function renderOpen(
  overrides: Partial<Parameters<typeof RemoveListItemDialog>[0]> = {},
) {
  const onClose = vi.fn();
  const action = vi.fn(async (): Promise<ListItemFormState> => ({
    status: "idle",
  }));
  render(
    <RemoveListItemDialog
      open
      onClose={onClose}
      listId="l1"
      listTitle="Favorite Sci-Fi"
      mediaSlug="afterglow"
      mediaTitle="Afterglow"
      returnTo="/list/favorite-sci-fi"
      action={action}
      {...overrides}
    />,
  );
  return { onClose, action };
}

describe("RemoveListItemDialog", () => {
  beforeEach(() => {
    push.mockReset();
    refresh.mockReset();
  });

  it("names both the title and the list in an alert dialog", () => {
    renderOpen();
    const dialog = screen.getByRole("alertdialog", {
      name: /Remove this title/i,
    });
    expect(dialog).toHaveTextContent("Afterglow");
    expect(dialog).toHaveTextContent("Favorite Sci-Fi");
    expect(
      screen.getByRole("button", { name: "Remove title" }),
    ).toBeInTheDocument();
  });

  it("does not remove on open — only after the explicit confirm", async () => {
    const user = userEvent.setup();
    const { action } = renderOpen();
    expect(action).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Remove title" }));
    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
  });

  it("refreshes and closes on a successful removal", async () => {
    const user = userEvent.setup();
    const { onClose, action } = renderOpen();
    action.mockResolvedValue({
      status: "success",
      action: "removed",
      removed: true,
    });

    await user.click(screen.getByRole("button", { name: "Remove title" }));
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(onClose).toHaveBeenCalled();
  });

  // Kept last: a never-resolving action leaves the form pending for the rest of
  // the test, so it must not precede tests asserting a settled result.
  it("cannot be dismissed while the removal is pending", async () => {
    const user = userEvent.setup();
    const { action } = renderOpen();
    action.mockReturnValue(new Promise<never>(() => {}));

    await user.click(screen.getByRole("button", { name: "Remove title" }));

    // The confirm button disables to prevent a repeat submission and the
    // Cancel control is disabled so the removal can't be dismissed mid-flight.
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Removing/ })).toBeDisabled(),
    );
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
  });
});
