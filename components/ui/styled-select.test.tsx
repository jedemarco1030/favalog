import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { StyledSelect } from "@/components/ui/styled-select";

function Options() {
  return (
    <>
      <option value="a">Alpha</option>
      <option value="b">Beta</option>
      <option value="c">Gamma</option>
    </>
  );
}

describe("StyledSelect", () => {
  it("exposes the native select with its accessible name and current value", () => {
    render(
      <StyledSelect aria-label="Sort" defaultValue="b">
        <Options />
      </StyledSelect>,
    );

    const select = screen.getByRole("combobox", { name: "Sort" });
    expect(select).toHaveValue("b");
    // All options are exposed by the native control.
    expect(screen.getByRole("option", { name: "Alpha" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Gamma" })).toBeInTheDocument();
  });

  it("fires the native change handler when the value changes", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <StyledSelect aria-label="Genre" defaultValue="a" onChange={onChange}>
        <Options />
      </StyledSelect>,
    );

    await user.selectOptions(
      screen.getByRole("combobox", { name: "Genre" }),
      "c",
    );

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("combobox", { name: "Genre" })).toHaveValue("c");
  });

  it("honors the disabled prop", () => {
    render(
      <StyledSelect aria-label="Sort" disabled>
        <Options />
      </StyledSelect>,
    );

    expect(screen.getByRole("combobox", { name: "Sort" })).toBeDisabled();
  });

  it("forwards native attributes (id, name) to the underlying select", () => {
    render(
      <StyledSelect aria-label="Sort" id="my-select" name="sort">
        <Options />
      </StyledSelect>,
    );

    const select = screen.getByRole("combobox", { name: "Sort" });
    expect(select).toHaveAttribute("id", "my-select");
    expect(select).toHaveAttribute("name", "sort");
  });

  it("renders a decorative chevron that is hidden from assistive tech", () => {
    const { container } = render(
      <StyledSelect aria-label="Sort">
        <Options />
      </StyledSelect>,
    );

    // The decorative caret must not add a second accessible element; the only
    // exposed control is the native select.
    expect(screen.getAllByRole("combobox")).toHaveLength(1);
    const icon = container.querySelector("svg[aria-hidden='true']");
    expect(icon).not.toBeNull();
  });
});
