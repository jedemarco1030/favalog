import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LikeButton } from "@/components/likes/like-button";
import type { LikeFormState } from "@/components/likes/like-form";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

const TARGET_ID = "11111111-1111-4111-8111-111111111111";

function renderButton(
  action: (state: LikeFormState, formData: FormData) => Promise<LikeFormState>,
  overrides: Partial<React.ComponentProps<typeof LikeButton>> = {},
) {
  return render(
    <LikeButton
      targetType="review"
      targetId={TARGET_ID}
      label="Alice's review of Dune"
      initialLikeCount={3}
      initialViewerHasLiked={false}
      isAuthenticated
      signInHref="/auth/sign-in?returnTo=%2Ftitle%2Fdune"
      returnTo="/title/dune"
      action={action}
      {...overrides}
    />,
  );
}

describe("LikeButton", () => {
  beforeEach(() => push.mockReset());

  it("renders an unpressed Like affordance with the server-loaded count", () => {
    const action = vi.fn(async () => ({ status: "idle" }) as LikeFormState);
    const { container } = renderButton(action);

    const button = screen.getByRole("button", {
      name: /like alice's review of dune/i,
    });
    expect(button).toHaveAttribute("aria-pressed", "false");
    expect(button).toHaveTextContent("3");
    // The control submits the DESIRED next state (the opposite of current).
    expect(container.querySelector('input[name="isLiked"]')).toHaveAttribute(
      "value",
      "true",
    );
  });

  it("renders a pressed Liked state from the server-loaded initial bit", () => {
    const action = vi.fn(async () => ({ status: "idle" }) as LikeFormState);
    const { container } = renderButton(action, {
      initialViewerHasLiked: true,
      initialLikeCount: 4,
    });

    const button = screen.getByRole("button", {
      name: /unlike alice's review of dune/i,
    });
    expect(button).toHaveAttribute("aria-pressed", "true");
    expect(button).toHaveTextContent("4");
    expect(container.querySelector('input[name="isLiked"]')).toHaveAttribute(
      "value",
      "false",
    );
  });

  it("reflects the ACTUAL server-returned count and bit after a successful toggle", async () => {
    const user = userEvent.setup();
    const action = vi.fn(
      async () =>
        ({ status: "success", isLiked: true, likeCount: 4 }) as LikeFormState,
    );
    renderButton(action);

    await user.click(
      screen.getByRole("button", { name: /like alice's review of dune/i }),
    );

    const button = await screen.findByRole("button", {
      name: /unlike alice's review of dune/i,
    });
    expect(button).toHaveAttribute("aria-pressed", "true");
    expect(button).toHaveTextContent("4");
  });

  it("routes an expired session through the safe sign-in redirect", async () => {
    const user = userEvent.setup();
    const action = vi.fn(
      async () =>
        ({
          status: "unauthenticated",
          redirectTo: "/auth/sign-in?returnTo=%2Ftitle%2Fdune",
        }) as LikeFormState,
    );
    renderButton(action);

    await user.click(
      screen.getByRole("button", { name: /like alice's review of dune/i }),
    );

    await waitFor(() =>
      expect(push).toHaveBeenCalledWith(
        "/auth/sign-in?returnTo=%2Ftitle%2Fdune",
      ),
    );
  });

  it("shows a controlled error alert on a failed write, without redirecting", async () => {
    const user = userEvent.setup();
    const action = vi.fn(
      async () =>
        ({
          status: "error",
          message: "This item is no longer available.",
        }) as LikeFormState,
    );
    renderButton(action);

    await user.click(
      screen.getByRole("button", { name: /like alice's review of dune/i }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "This item is no longer available.",
    );
    expect(push).not.toHaveBeenCalled();
  });

  it("disables the button while the write is pending (no duplicate submits)", async () => {
    const user = userEvent.setup();
    const action = vi.fn(() => new Promise<LikeFormState>(() => {}));
    renderButton(action);

    const button = screen.getByRole("button", {
      name: /like alice's review of dune/i,
    });
    await user.click(button);

    await waitFor(() => expect(button).toBeDisabled());
    expect(action).toHaveBeenCalledTimes(1);
  });

  it("shows a real count and a sign-in link (never a dead toggle) when signed out", () => {
    const action = vi.fn(async () => ({ status: "idle" }) as LikeFormState);
    renderButton(action, { isAuthenticated: false });

    const link = screen.getByRole("link", {
      name: /sign in to like alice's review of dune/i,
    });
    expect(link).toHaveAttribute(
      "href",
      "/auth/sign-in?returnTo=%2Ftitle%2Fdune",
    );
    expect(link).toHaveTextContent("3");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("renders a controlled unavailable state when available is false", () => {
    const action = vi.fn(async () => ({ status: "idle" }) as LikeFormState);
    renderButton(action, { available: false });

    expect(
      screen.getByRole("button", { name: /like alice's review of dune/i }),
    ).toBeDisabled();
    expect(screen.getByRole("alert")).toHaveTextContent(/isn't available/i);
  });
});
