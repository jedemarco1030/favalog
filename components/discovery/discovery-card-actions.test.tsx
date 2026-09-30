import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { CreateListFormState } from "@/app/lists/list-form";
import type { DiscoverySaveState } from "@/app/discovery/save-form";
import type { ExternalRef } from "@/lib/catalog/types";
import {
  DiscoveryCardActions,
  type DiscoveryCreateListAction,
  type DiscoverySaveAction,
  type SaveListOption,
} from "./discovery-card-actions";

const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn() }),
  usePathname: () => "/explore",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/app/discovery/actions", () => ({
  createAndSaveDiscoveredTitleAction: vi.fn(),
}));

const identity: ExternalRef = {
  provider: "tmdb",
  kind: "movie",
  externalId: "movie:693134",
};

const existingLists: SaveListOption[] = [
  { id: "list-1", title: "Weekend watch" },
  { id: "list-2", title: "Sci-fi" },
];

function savedTo(listId: string): DiscoverySaveState {
  return {
    status: "success",
    listId,
    listSlug: `slug-${listId}`,
    mediaSlug: "dune-part-two",
  };
}

function createdList(listId: string, title: string): CreateListFormState {
  return { status: "success", listId, title, slug: `slug-${listId}` };
}

function renderActions({
  lists,
  saveAction = vi.fn<DiscoverySaveAction>(async (_s, fd) =>
    savedTo(String(fd.get("listId"))),
  ),
  createAction = vi.fn<DiscoveryCreateListAction>(async () =>
    createdList("list-new", "Rewatch"),
  ),
}: {
  lists: SaveListOption[];
  saveAction?: ReturnType<typeof vi.fn<DiscoverySaveAction>>;
  createAction?: ReturnType<typeof vi.fn<DiscoveryCreateListAction>>;
}) {
  render(
    <DiscoveryCardActions
      identity={identity}
      title="Dune: Part Two"
      lists={lists}
      returnTo="/explore"
      openAction={vi.fn(async () => ({ status: "idle" as const }))}
      saveAction={saveAction}
      createAction={createAction}
    />,
  );
  return { saveAction, createAction };
}

async function openDialog() {
  const user = userEvent.setup();
  await user.click(
    screen.getByRole("button", { name: /Dune: Part Two to a list$/ }),
  );
  const dialog = screen.getByRole("dialog", {
    name: "Save “Dune: Part Two”",
  });
  return { user, dialog };
}

describe("DiscoveryCardActions save dialog", () => {
  it("offers Create new list alongside existing lists", async () => {
    renderActions({ lists: existingLists });
    const { dialog } = await openDialog();

    expect(
      within(dialog).getByRole("radio", { name: "Weekend watch" }),
    ).toBeChecked();
    expect(within(dialog).getByRole("radio", { name: "Sci-fi" })).toBeVisible();
    expect(
      within(dialog).getByRole("button", { name: "Create new list" }),
    ).toBeVisible();
  });

  it("creates a list with the chosen visibility and saves the title to it for a user with lists", async () => {
    const { saveAction, createAction } = renderActions({
      lists: existingLists,
    });
    const { user, dialog } = await openDialog();

    await user.click(
      within(dialog).getByRole("button", { name: "Create new list" }),
    );
    const name = within(dialog).getByLabelText("List name");
    expect(name).toHaveFocus();
    await user.type(name, "Rewatch");
    await user.click(within(dialog).getByRole("radio", { name: /Followers/ }));
    await user.click(
      within(dialog).getByRole("button", { name: "Create and save" }),
    );

    expect(
      await within(dialog).findByText(
        "Created Rewatch and saved Dune: Part Two.",
      ),
    ).toBeVisible();
    expect(createAction).toHaveBeenCalledTimes(1);
    const createData = createAction.mock.calls[0][1];
    expect(createData.get("title")).toBe("Rewatch");
    expect(createData.get("visibility")).toBe("followers");

    expect(saveAction).toHaveBeenCalledTimes(1);
    const saveData = saveAction.mock.calls[0][1];
    expect(saveData.get("listId")).toBe("list-new");
    expect(saveData.get("externalId")).toBe("movie:693134");
    expect(saveData.get("provider")).toBe("tmdb");
    expect(
      within(dialog).getByRole("link", { name: "View list" }),
    ).toHaveAttribute("href", "/list/slug-list-new");
  });

  it("creates a first list and saves the title for a user with no lists", async () => {
    const { saveAction, createAction } = renderActions({ lists: [] });
    const { user, dialog } = await openDialog();

    expect(within(dialog).getByText(/any lists yet/)).toBeVisible();
    expect(
      within(dialog).queryByRole("button", { name: "Cancel" }),
    ).not.toBeInTheDocument();
    await user.type(within(dialog).getByLabelText("List name"), "Rewatch");
    await user.click(
      within(dialog).getByRole("button", { name: "Create and save" }),
    );

    expect(
      await within(dialog).findByText(
        "Created Rewatch and saved Dune: Part Two.",
      ),
    ).toBeVisible();
    expect(createAction).toHaveBeenCalledTimes(1);
    expect(createAction.mock.calls[0][1].get("visibility")).toBe("public");
    expect(saveAction.mock.calls[0][1].get("listId")).toBe("list-new");
  });

  it("uses a confirmed combined response without a second save request", async () => {
    const createAction = vi.fn<DiscoveryCreateListAction>(async () => ({
      ...createdList("list-new", "Rewatch"),
      save: savedTo("list-new"),
    }));
    const { saveAction } = renderActions({ lists: [], createAction });
    const { user, dialog } = await openDialog();
    await user.type(within(dialog).getByLabelText("List name"), "Rewatch");
    await user.click(
      within(dialog).getByRole("button", { name: "Create and save" }),
    );
    expect(await within(dialog).findByRole("status")).toHaveTextContent(
      "Created Rewatch and saved Dune: Part Two.",
    );
    expect(createAction).toHaveBeenCalledTimes(1);
    expect(createAction.mock.calls[0][1].get("externalId")).toBe(
      identity.externalId,
    );
    expect(saveAction).not.toHaveBeenCalled();
  });

  it("retries only save after a combined response reports partial failure", async () => {
    const createAction = vi.fn<DiscoveryCreateListAction>(async () => ({
      ...createdList("list-new", "Rewatch"),
      save: { status: "error", message: "Try again." },
    }));
    const { saveAction } = renderActions({ lists: [], createAction });
    const { user, dialog } = await openDialog();
    await user.type(within(dialog).getByLabelText("List name"), "Rewatch");
    await user.click(
      within(dialog).getByRole("button", { name: "Create and save" }),
    );
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "wasn't saved yet",
    );
    expect(saveAction).not.toHaveBeenCalled();
    await user.click(
      within(dialog).getByRole("button", { name: "Retry save" }),
    );
    expect(await within(dialog).findByRole("status")).toHaveTextContent(
      "Created Rewatch and saved Dune: Part Two.",
    );
    expect(createAction).toHaveBeenCalledTimes(1);
    expect(saveAction).toHaveBeenCalledTimes(1);
    expect(saveAction.mock.calls[0][1].get("listId")).toBe("list-new");
  });

  it("cancel returns to the picker with the prior selection and focus on the trigger", async () => {
    const { createAction, saveAction } = renderActions({
      lists: existingLists,
    });
    const { user, dialog } = await openDialog();

    await user.click(within(dialog).getByRole("radio", { name: "Sci-fi" }));
    await user.click(
      within(dialog).getByRole("button", { name: "Create new list" }),
    );
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));

    expect(within(dialog).getByRole("radio", { name: "Sci-fi" })).toBeChecked();
    expect(
      within(dialog).getByRole("button", { name: "Create new list" }),
    ).toHaveFocus();
    expect(
      within(dialog).getByRole("heading", { name: "Save “Dune: Part Two”" }),
    ).toBeVisible();
    expect(createAction).not.toHaveBeenCalled();
    expect(saveAction).not.toHaveBeenCalled();
  });

  it("keeps the created list when saving fails and retries only the save", async () => {
    const saveAction = vi
      .fn<DiscoverySaveAction>()
      .mockResolvedValueOnce({
        status: "error",
        message: "Try again in a moment.",
      } satisfies DiscoverySaveState)
      .mockImplementation(async (_s, fd) => savedTo(String(fd.get("listId"))));
    const createAction = vi.fn<DiscoveryCreateListAction>(async () =>
      createdList("list-new", "Rewatch"),
    );
    renderActions({ lists: existingLists, saveAction, createAction });
    const { user, dialog } = await openDialog();

    await user.click(
      within(dialog).getByRole("button", { name: "Create new list" }),
    );
    await user.type(within(dialog).getByLabelText("List name"), "Rewatch");
    await user.click(
      within(dialog).getByRole("button", { name: "Create and save" }),
    );

    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "Created Rewatch, but Dune: Part Two wasn't saved yet. Try again in a moment.",
    );
    expect(
      within(dialog).getByRole("radio", { name: "Rewatch" }),
    ).toBeChecked();
    const retry = within(dialog).getByRole("button", { name: "Retry save" });
    await waitFor(() => expect(retry).toHaveFocus());

    await user.click(retry);

    expect(
      await within(dialog).findByText(
        "Created Rewatch and saved Dune: Part Two.",
      ),
    ).toBeVisible();
    expect(createAction).toHaveBeenCalledTimes(1);
    expect(saveAction).toHaveBeenCalledTimes(2);
    expect(saveAction.mock.calls[1][1].get("listId")).toBe("list-new");
  });

  it("shows validation errors without saving or losing the draft", async () => {
    const createAction = vi.fn<DiscoveryCreateListAction>(async () => ({
      status: "invalid",
      fieldErrors: { title: "That title is too long." },
    }));
    const { saveAction } = renderActions({ lists: [], createAction });
    const { user, dialog } = await openDialog();

    const name = within(dialog).getByLabelText("List name");
    await user.type(name, "Rewatch");
    await user.click(
      within(dialog).getByRole("button", { name: "Create and save" }),
    );

    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "That title is too long.",
    );
    expect(name).toHaveValue("Rewatch");
    expect(name).toHaveAttribute("aria-invalid", "true");
    expect(saveAction).not.toHaveBeenCalled();
  });

  it("saves to an existing list unchanged", async () => {
    const { saveAction, createAction } = renderActions({
      lists: existingLists,
    });
    const { user, dialog } = await openDialog();

    await user.click(
      within(dialog).getByRole("button", { name: "Save to list" }),
    );

    expect(
      await within(dialog).findByText("Saved to Weekend watch."),
    ).toBeVisible();
    expect(saveAction.mock.calls[0][1].get("listId")).toBe("list-1");
    expect(createAction).not.toHaveBeenCalled();
  });
});
