import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { FavoriteButton } from "@/components/media/favorite-button";
import type { FavoriteFormState } from "@/app/title/[slug]/favorite-form";

// The control calls `router.push` for the auth / onboarding cases.
const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

function renderButton(
  action: (
    state: FavoriteFormState,
    formData: FormData,
  ) => Promise<FavoriteFormState>,
  overrides: Partial<React.ComponentProps<typeof FavoriteButton>> = {},
) {
  return render(
    <FavoriteButton
      mediaSlug="afterglow"
      mediaTitle="Afterglow"
      returnTo="/title/afterglow"
      initialIsFavorite={false}
      available
      action={action}
      {...overrides}
    />,
  );
}

describe("FavoriteButton", () => {
  beforeEach(() => push.mockReset());

  it("renders a neutral, unpressed Favorite affordance", () => {
    const action = vi.fn(async () => ({ status: "idle" }) as FavoriteFormState);
    const { container } = renderButton(action);

    const button = screen.getByRole("button", {
      name: /add afterglow to your favorites/i,
    });
    expect(button).toHaveAttribute("aria-pressed", "false");
    expect(button).toHaveTextContent("Favorite");
    // The desired next state submitted on click is the opposite of current.
    expect(container.querySelector('input[name="isFavorite"]')).toHaveAttribute(
      "value",
      "true",
    );
  });

  it("renders a pressed Favorited state from the server-loaded initial state", () => {
    const action = vi.fn(async () => ({ status: "idle" }) as FavoriteFormState);
    const { container } = renderButton(action, { initialIsFavorite: true });

    const button = screen.getByRole("button", {
      name: /remove afterglow from your favorites/i,
    });
    expect(button).toHaveAttribute("aria-pressed", "true");
    expect(button).toHaveTextContent("Favorited");
    expect(container.querySelector('input[name="isFavorite"]')).toHaveAttribute(
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
          isFavorite: true,
          slug: "afterglow",
        }) as FavoriteFormState,
    );
    renderButton(action);

    await user.click(screen.getByRole("button", { name: /add afterglow/i }));

    const button = await screen.findByRole("button", {
      name: /remove afterglow from your favorites/i,
    });
    expect(button).toHaveAttribute("aria-pressed", "true");
    expect(button).toHaveTextContent("Favorited");
  });

  it("routes an expired session through the safe sign-in redirect", async () => {
    const user = userEvent.setup();
    const action = vi.fn(
      async () =>
        ({
          status: "unauthenticated",
          redirectTo: "/auth/sign-in?returnTo=%2Ftitle%2Fafterglow",
        }) as FavoriteFormState,
    );
    renderButton(action);

    await user.click(screen.getByRole("button", { name: /add afterglow/i }));

    await waitFor(() =>
      expect(push).toHaveBeenCalledWith(
        "/auth/sign-in?returnTo=%2Ftitle%2Fafterglow",
      ),
    );
  });

  it("shows a controlled error alert on a failed write, without redirecting", async () => {
    const user = userEvent.setup();
    const action = vi.fn(
      async () =>
        ({
          status: "error",
          message: "We couldn't update your favorites just now.",
        }) as FavoriteFormState,
    );
    renderButton(action);

    await user.click(screen.getByRole("button", { name: /add afterglow/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "We couldn't update your favorites just now.",
    );
    expect(push).not.toHaveBeenCalled();
  });

  it("disables the button while the write is pending (no duplicate submissions)", async () => {
    const user = userEvent.setup();
    // A never-resolving action keeps the form in its pending state.
    const action = vi.fn(() => new Promise<FavoriteFormState>(() => {}));
    renderButton(action);

    const button = screen.getByRole("button", { name: /add afterglow/i });
    await user.click(button);

    await waitFor(() => expect(button).toBeDisabled());
    expect(action).toHaveBeenCalledTimes(1);
  });

  it("renders a controlled unavailable state when the catalog slug can't be resolved", () => {
    const action = vi.fn(async () => ({ status: "idle" }) as FavoriteFormState);
    renderButton(action, { available: false });

    expect(
      screen.getByRole("button", { name: /add afterglow/i }),
    ).toBeDisabled();
    expect(screen.getByRole("alert")).toHaveTextContent(/isn't available/i);
  });
});
