import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();
const refresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh }),
}));

import { AddToListDialog } from "@/components/lists/add-to-list-dialog";
import type {
  CreateListFormState,
  ListItemFormState,
} from "@/app/lists/list-form";
import type { ListMembershipView } from "@/lib/supabase/list-view-model";

const media = { slug: "afterglow", title: "Afterglow" };

function makeList(
  overrides: Partial<ListMembershipView> = {},
): ListMembershipView {
  return {
    id: "l1",
    slug: "favorite-sci-fi",
    title: "Favorite Sci-Fi",
    description: null,
    visibility: "public",
    isRanked: false,
    itemCount: 2,
    updatedAt: "2026-08-19T15:31:00.000Z",
    containsMedia: false,
    ...overrides,
  };
}

const noopCreate = async (): Promise<CreateListFormState> => ({
  status: "idle",
});

function renderDialog(
  overrides: Partial<Parameters<typeof AddToListDialog>[0]> = {},
) {
  const onClose = vi.fn();
  const addAction = vi.fn(async (): Promise<ListItemFormState> => ({
    status: "idle",
  }));
  const removeAction = vi.fn(async (): Promise<ListItemFormState> => ({
    status: "idle",
  }));
  render(
    <AddToListDialog
      open
      onClose={onClose}
      media={media}
      returnTo="/title/afterglow"
      lists={[makeList()]}
      mediaKnown
      addAction={addAction}
      removeAction={removeAction}
      createAction={noopCreate}
      {...overrides}
    />,
  );
  return { onClose, addAction, removeAction };
}

describe("AddToListDialog", () => {
  beforeEach(() => {
    push.mockReset();
    refresh.mockReset();
  });

  it("opens with an accessible dialog name and specific toggle labels", () => {
    renderDialog({
      lists: [
        makeList({ id: "l1", title: "Favorite Sci-Fi", containsMedia: false }),
        makeList({
          id: "l2",
          slug: "rewatch",
          title: "Rewatch",
          containsMedia: true,
          visibility: "private",
        }),
      ],
    });

    expect(
      screen.getByRole("dialog", { name: /Add .Afterglow. to a list/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Add Afterglow to Favorite Sci-Fi" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Remove Afterglow from Rewatch" }),
    ).toBeInTheDocument();
  });

  it("reflects an added title and offers a View list link after a successful add", async () => {
    const user = userEvent.setup();
    const { addAction } = renderDialog();
    addAction.mockResolvedValue({
      status: "success",
      action: "added",
      slug: "favorite-sci-fi",
      listId: "l1",
    });

    await user.click(
      screen.getByRole("button", { name: "Add Afterglow to Favorite Sci-Fi" }),
    );

    expect(
      await screen.findByRole("button", {
        name: "Remove Afterglow from Favorite Sci-Fi",
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View list" })).toHaveAttribute(
      "href",
      "/list/favorite-sci-fi",
    );
  });

  it("reflects a removed title after a successful remove", async () => {
    const user = userEvent.setup();
    const { removeAction } = renderDialog({
      lists: [makeList({ containsMedia: true })],
    });
    removeAction.mockResolvedValue({
      status: "success",
      action: "removed",
      slug: "favorite-sci-fi",
      listId: "l1",
    });

    await user.click(
      screen.getByRole("button", {
        name: "Remove Afterglow from Favorite Sci-Fi",
      }),
    );

    expect(
      await screen.findByRole("button", {
        name: "Add Afterglow to Favorite Sci-Fi",
      }),
    ).toBeInTheDocument();
  });

  it("still reflects membership when an add is idempotent (already present)", async () => {
    const user = userEvent.setup();
    const { addAction } = renderDialog();
    addAction.mockResolvedValue({
      status: "success",
      action: "added",
      alreadyPresent: true,
      slug: "favorite-sci-fi",
      listId: "l1",
    });

    await user.click(
      screen.getByRole("button", { name: "Add Afterglow to Favorite Sci-Fi" }),
    );

    expect(
      await screen.findByRole("button", {
        name: "Remove Afterglow from Favorite Sci-Fi",
      }),
    ).toBeInTheDocument();
  });

  it("shows an inline create form when the viewer has no lists", () => {
    renderDialog({ lists: [] });

    expect(screen.getByLabelText("List title")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Create & add" }),
    ).toBeInTheDocument();
  });

  it("shows a controlled unavailable state (no toggles) when the media is unknown", () => {
    renderDialog({ mediaKnown: false });

    expect(
      screen.getByText(/isn't available to add to lists right now/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Add Afterglow to/ }),
    ).not.toBeInTheDocument();
    // Only Close controls remain (the header dismiss and the blocked-state
    // Close), and no membership toggles.
    expect(
      screen.getAllByRole("button", { name: "Close" }).length,
    ).toBeGreaterThanOrEqual(1);
  });

  it("shows a controlled read-error state (no toggles) when the lists couldn't be read", () => {
    renderDialog({
      error: "We couldn't load your lists just now. Please try again.",
    });

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent(/couldn't load your lists/i);
    expect(
      screen.queryByRole("button", { name: /Add Afterglow to/ }),
    ).not.toBeInTheDocument();
    expect(
      within(dialog).getAllByRole("button", { name: "Close" }).length,
    ).toBeGreaterThanOrEqual(1);
  });

  it("closes when the Close control is activated", async () => {
    const user = userEvent.setup();
    const { onClose } = renderDialog();

    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalled();
  });

  it("is keyboard operable — the toggle can be reached and activated", async () => {
    const user = userEvent.setup();
    const { addAction } = renderDialog();
    addAction.mockResolvedValue({
      status: "success",
      action: "added",
      slug: "favorite-sci-fi",
      listId: "l1",
    });

    const toggle = screen.getByRole("button", {
      name: "Add Afterglow to Favorite Sci-Fi",
    });
    toggle.focus();
    expect(toggle).toHaveFocus();
    await user.keyboard("{Enter}");

    await waitFor(() => expect(addAction).toHaveBeenCalled());
  });
});
