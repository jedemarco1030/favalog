import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { ListActions } from "@/components/lists/list-actions";

describe("ListActions", () => {
  it("toggles the like state and count optimistically", async () => {
    const user = userEvent.setup();
    render(<ListActions likeCount={41} />);

    const like = screen.getByRole("button", { name: "Like this list" });
    expect(like).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByText("41 likes")).toBeInTheDocument();

    await user.click(like);

    const pressed = screen.getByRole("button", { name: "Unlike this list" });
    expect(pressed).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("42 likes")).toBeInTheDocument();

    await user.click(pressed);
    expect(
      screen.getByRole("button", { name: "Like this list" }),
    ).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByText("41 likes")).toBeInTheDocument();
  });

  it("confirms a share action without persisting anything", async () => {
    const user = userEvent.setup();
    render(<ListActions likeCount={10} />);

    const share = screen.getByRole("button", { name: "Share this list" });
    expect(share).toHaveTextContent("Share");

    await user.click(share);
    expect(share).toHaveTextContent("Link copied");
  });
});
