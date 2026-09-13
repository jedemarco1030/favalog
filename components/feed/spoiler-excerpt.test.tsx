import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { SpoilerExcerpt } from "@/components/feed/spoiler-excerpt";

/**
 * The behaviour this guards is the one the app was missing entirely: a review
 * marked `contains_spoilers` must be genuinely CONCEALED, not merely
 * italicised. "Concealed" means the text is absent from the accessibility tree
 * and the DOM until the reader explicitly asks for it.
 */
describe("SpoilerExcerpt", () => {
  const excerpt = "The lighthouse keeper was the narrator all along.";

  it("renders the excerpt directly when it carries no spoilers", () => {
    render(
      <SpoilerExcerpt
        excerpt={excerpt}
        containsSpoilers={false}
        mediaTitle="Afterglow"
      />,
    );

    expect(screen.getByText(/lighthouse keeper/)).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("conceals spoiler-marked writing until it is explicitly revealed", async () => {
    const user = userEvent.setup();
    render(
      <SpoilerExcerpt
        excerpt={excerpt}
        containsSpoilers
        mediaTitle="Afterglow"
      />,
    );

    // Concealed: the words are simply not present.
    expect(screen.queryByText(/lighthouse keeper/)).not.toBeInTheDocument();
    expect(screen.getByText(/contains spoilers/i)).toBeInTheDocument();

    const reveal = screen.getByRole("button", {
      name: /show spoilers for Afterglow/i,
    });
    expect(reveal).toHaveAttribute("aria-expanded", "false");

    await user.click(reveal);

    expect(screen.getByText(/lighthouse keeper/)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /spoilers shown/i }),
    ).toHaveAttribute("aria-expanded", "true");
  });

  it("is operable from the keyboard alone", async () => {
    const user = userEvent.setup();
    render(
      <SpoilerExcerpt
        excerpt={excerpt}
        containsSpoilers
        mediaTitle="Afterglow"
      />,
    );

    await user.tab();
    expect(
      screen.getByRole("button", { name: /show spoilers for Afterglow/i }),
    ).toHaveFocus();

    await user.keyboard("{Enter}");
    expect(screen.getByText(/lighthouse keeper/)).toBeInTheDocument();
  });
});
