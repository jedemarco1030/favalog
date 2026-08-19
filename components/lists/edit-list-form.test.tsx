import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();
const refresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh }),
}));

import {
  EditListForm,
  type EditListInitialValues,
} from "@/components/lists/edit-list-form";
import type { EditListFormState } from "@/app/lists/list-form";

const initial: EditListInitialValues = {
  listId: "11111111-1111-1111-1111-111111111111",
  title: "Favorite Sci-Fi",
  description: "A canon.",
  isRanked: true,
  visibility: "private",
};

function renderForm(
  overrides: Partial<Parameters<typeof EditListForm>[0]> = {},
) {
  const action = vi.fn(async (): Promise<EditListFormState> => ({
    status: "idle",
  }));
  render(
    <EditListForm
      action={action}
      initial={initial}
      returnTo="/list/favorite-sci-fi"
      {...overrides}
    />,
  );
  return { action };
}

describe("EditListForm", () => {
  beforeEach(() => {
    push.mockReset();
    refresh.mockReset();
  });

  it("pre-fills every field from the current metadata", () => {
    renderForm();
    expect(screen.getByLabelText("List title")).toHaveValue("Favorite Sci-Fi");
    expect(screen.getByLabelText(/Description/)).toHaveValue("A canon.");
    expect(screen.getByRole("checkbox", { name: /Ranked list/ })).toBeChecked();
    expect(screen.getByRole("radio", { name: /Private/ })).toBeChecked();
    expect(screen.getByRole("radio", { name: /Public/ })).not.toBeChecked();
  });

  it("submits only the allow-listed fields (never a slug)", async () => {
    const user = userEvent.setup();
    let submitted: FormData | null = null;
    const action = vi.fn(
      async (
        _state: EditListFormState,
        formData: FormData,
      ): Promise<EditListFormState> => {
        submitted = formData;
        return { status: "success", listId: initial.listId, slug: "x" };
      },
    );
    renderForm({ action });

    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(action).toHaveBeenCalled());
    const form = submitted as unknown as FormData;
    expect(form.get("listId")).toBe(initial.listId);
    expect(form.get("slug")).toBeNull();
  });

  it("shows field errors returned by an invalid action result", async () => {
    const user = userEvent.setup();
    const action = vi.fn(async (): Promise<EditListFormState> => ({
      status: "invalid",
      message: "Please fix the highlighted fields.",
      fieldErrors: { title: "Give your list a title." },
    }));
    renderForm({ action });

    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(
      await screen.findByText("Give your list a title."),
    ).toBeInTheDocument();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Please fix the highlighted fields.",
    );
  });

  it("calls onSaved when the action reports success", async () => {
    const user = userEvent.setup();
    const successState: EditListFormState = {
      status: "success",
      listId: initial.listId,
      slug: "favorite-sci-fi",
    };
    const action = vi.fn(async (): Promise<EditListFormState> => successState);
    const onSaved = vi.fn();
    renderForm({ action, onSaved });

    await user.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(successState));
  });
});
