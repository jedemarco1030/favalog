import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { RatingInput } from "@/components/media/rating-input";

describe("RatingInput", () => {
  it("renders an accessible radiogroup with a keyboard-selectable half-star scale", () => {
    render(
      <form>
        <RatingInput />
      </form>,
    );
    const group = screen.getByRole("radiogroup", { name: "Your rating" });
    expect(group).toBeInTheDocument();
    // 10 half-star options + a "No rating" option.
    expect(screen.getAllByRole("radio")).toHaveLength(11);
    expect(screen.getByRole("radio", { name: "No rating" })).toBeChecked();
    expect(
      screen.getByRole("radio", { name: "3.5 stars" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "1 star" })).toBeInTheDocument();
  });

  it("submits the selected rating and can be cleared back to no rating", async () => {
    const user = userEvent.setup();
    render(
      <form aria-label="log">
        <RatingInput />
      </form>,
    );

    await user.click(screen.getByRole("radio", { name: "4.5 stars" }));
    expect(screen.getByRole("radio", { name: "4.5 stars" })).toBeChecked();

    const form = screen.getByRole("form", { name: "log" }) as HTMLFormElement;
    expect(new FormData(form).get("rating")).toBe("4.5");

    await user.click(screen.getByRole("radio", { name: "No rating" }));
    expect(new FormData(form).get("rating")).toBe("");
  });

  it("honours a defaultValue", () => {
    render(
      <form>
        <RatingInput defaultValue={3} />
      </form>,
    );
    expect(screen.getByRole("radio", { name: "3 stars" })).toBeChecked();
  });
});
