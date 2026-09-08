import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { FollowButton } from "@/components/user/follow-button";
import type { FollowFormState } from "@/app/profile/[username]/follow-form";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

function renderButton(
  action: (
    state: FollowFormState,
    formData: FormData,
  ) => Promise<FollowFormState>,
  overrides: Partial<React.ComponentProps<typeof FollowButton>> = {},
) {
  return render(
    <FollowButton
      username="alice"
      targetDisplayName="Alice Rivera"
      returnTo="/profile/alice"
      initialIsFollowing={false}
      available
      action={action}
      {...overrides}
    />,
  );
}

describe("FollowButton", () => {
  beforeEach(() => push.mockReset());

  it("renders a neutral, unpressed Follow affordance when not following", () => {
    const action = vi.fn(async () => ({ status: "idle" }) as FollowFormState);
    const { container } = renderButton(action);

    const button = screen.getByRole("button", {
      name: /follow alice rivera/i,
    });
    expect(button).toHaveAttribute("aria-pressed", "false");
    expect(button).toHaveTextContent("Follow");
    expect(container.querySelector('input[name="isFollow"]')).toHaveAttribute(
      "value",
      "true",
    );
  });

  it("renders a pressed Following state from the server-loaded initial state", () => {
    const action = vi.fn(async () => ({ status: "idle" }) as FollowFormState);
    const { container } = renderButton(action, { initialIsFollowing: true });

    const button = screen.getByRole("button", {
      name: /unfollow alice rivera/i,
    });
    expect(button).toHaveAttribute("aria-pressed", "true");
    expect(button).toHaveTextContent("Following");
    expect(container.querySelector('input[name="isFollow"]')).toHaveAttribute(
      "value",
      "false",
    );
  });

  it("reflects the ACTUAL server-returned state after a successful toggle", async () => {
    const user = userEvent.setup();
    const action = vi.fn(
      async () =>
        ({
          status: "success",
          isFollowing: true,
          username: "alice",
        }) as FollowFormState,
    );
    renderButton(action);

    await user.click(
      screen.getByRole("button", { name: /follow alice rivera/i }),
    );

    const button = await screen.findByRole("button", {
      name: /unfollow alice rivera/i,
    });
    expect(button).toHaveAttribute("aria-pressed", "true");
    expect(button).toHaveTextContent("Following");
  });

  it("routes an expired session through the safe sign-in redirect", async () => {
    const user = userEvent.setup();
    const action = vi.fn(
      async () =>
        ({
          status: "unauthenticated",
          redirectTo: "/auth/sign-in?returnTo=%2Fprofile%2Falice",
        }) as FollowFormState,
    );
    renderButton(action);

    await user.click(
      screen.getByRole("button", { name: /follow alice rivera/i }),
    );

    await waitFor(() =>
      expect(push).toHaveBeenCalledWith(
        "/auth/sign-in?returnTo=%2Fprofile%2Falice",
      ),
    );
  });

  it("shows a controlled error alert on a failed write, without redirecting", async () => {
    const user = userEvent.setup();
    const action = vi.fn(
      async () =>
        ({
          status: "error",
          message: "We couldn't update this follow right now.",
        }) as FollowFormState,
    );
    renderButton(action);

    await user.click(
      screen.getByRole("button", { name: /follow alice rivera/i }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "We couldn't update this follow right now.",
    );
    expect(push).not.toHaveBeenCalled();
  });

  it("disables the button while the write is pending", async () => {
    const user = userEvent.setup();
    const action = vi.fn(() => new Promise<FollowFormState>(() => {}));
    renderButton(action);

    const button = screen.getByRole("button", { name: /follow alice rivera/i });
    await user.click(button);

    await waitFor(() => expect(button).toBeDisabled());
    expect(action).toHaveBeenCalledTimes(1);
  });

  it("renders a controlled unavailable state when available is false", () => {
    const action = vi.fn(async () => ({ status: "idle" }) as FollowFormState);
    renderButton(action, { available: false });

    expect(
      screen.getByRole("button", { name: /follow alice rivera/i }),
    ).toBeDisabled();
    expect(screen.getByRole("alert")).toHaveTextContent(/isn't available/i);
  });
});
