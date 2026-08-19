import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();
const refresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh }),
}));

import { CreateListForm } from "@/components/lists/create-list-form";
import type { CreateListFormState } from "@/app/lists/list-form";

describe("CreateListForm", () => {
  beforeEach(() => {
    push.mockReset();
    refresh.mockReset();
  });

  it("renders the title, description, ranked, and visibility fields", () => {
    const action = vi.fn(async (): Promise<CreateListFormState> => ({
      status: "idle",
    }));
    render(<CreateListForm action={action} returnTo="/lists" />);

    expect(screen.getByLabelText("List title")).toBeInTheDocument();
    expect(screen.getByLabelText(/Description/)).toBeInTheDocument();
    expect(
      screen.getByRole("checkbox", { name: /Ranked list/ }),
    ).toBeInTheDocument();
    const publicRadio = screen.getByRole("radio", { name: /Public/ });
    const privateRadio = screen.getByRole("radio", { name: /Private/ });
    expect(publicRadio).toBeChecked();
    expect(privateRadio).not.toBeChecked();
    expect(
      screen.getByRole("button", { name: "Create list" }),
    ).toBeInTheDocument();
  });

  it("lets the visibility be switched to private and toggles the ranked checkbox", async () => {
    const user = userEvent.setup();
    const action = vi.fn(async (): Promise<CreateListFormState> => ({
      status: "idle",
    }));
    render(<CreateListForm action={action} returnTo="/lists" />);

    const privateRadio = screen.getByRole("radio", { name: /Private/ });
    await user.click(privateRadio);
    expect(privateRadio).toBeChecked();
    expect(screen.getByRole("radio", { name: /Public/ })).not.toBeChecked();

    const ranked = screen.getByRole("checkbox", { name: /Ranked list/ });
    expect(ranked).not.toBeChecked();
    await user.click(ranked);
    expect(ranked).toBeChecked();
  });

  it("shows field errors returned by an invalid action result", async () => {
    const user = userEvent.setup();
    const action = vi.fn(async (): Promise<CreateListFormState> => ({
      status: "invalid",
      message: "Please fix the highlighted fields.",
      fieldErrors: { title: "Give your list a title." },
    }));
    render(<CreateListForm action={action} returnTo="/lists" />);

    await user.type(screen.getByLabelText("List title"), "x");
    await user.click(screen.getByRole("button", { name: "Create list" }));

    expect(
      await screen.findByText("Give your list a title."),
    ).toBeInTheDocument();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Please fix the highlighted fields.",
    );
  });

  it("calls onCreated when the action reports success", async () => {
    const user = userEvent.setup();
    const successState: CreateListFormState = {
      status: "success",
      listId: "l1",
      slug: "favorite-sci-fi",
      title: "Favorite Sci-Fi",
    };
    const action = vi.fn(
      async (): Promise<CreateListFormState> => successState,
    );
    const onCreated = vi.fn();
    render(
      <CreateListForm
        action={action}
        returnTo="/lists"
        onCreated={onCreated}
      />,
    );

    await user.type(screen.getByLabelText("List title"), "Favorite Sci-Fi");
    await user.click(screen.getByRole("button", { name: "Create list" }));

    await waitFor(() => expect(onCreated).toHaveBeenCalledWith(successState));
  });

  it("submits a hidden mediaSlug field in the create-and-add flow", async () => {
    const user = userEvent.setup();
    let submitted: FormData | null = null;
    const action = vi.fn(
      async (
        _state: CreateListFormState,
        formData: FormData,
      ): Promise<CreateListFormState> => {
        submitted = formData;
        return { status: "success", listId: "l1", slug: "afterglow-picks" };
      },
    );
    render(
      <CreateListForm
        action={action}
        returnTo="/title/afterglow"
        mediaSlug="afterglow"
        submitLabel="Create & add"
      />,
    );

    await user.type(screen.getByLabelText("List title"), "Afterglow Picks");
    await user.click(screen.getByRole("button", { name: "Create & add" }));

    await waitFor(() => expect(action).toHaveBeenCalled());
    expect(submitted).not.toBeNull();
    expect((submitted as unknown as FormData).get("mediaSlug")).toBe(
      "afterglow",
    );
  });
});
