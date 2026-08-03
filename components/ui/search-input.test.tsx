import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SearchInput } from "@/components/ui/search-input";

describe("SearchInput", () => {
  it("renders a labelled search field inside a search landmark", () => {
    render(<SearchInput />);
    expect(screen.getByRole("search")).toBeInTheDocument();
    const field = screen.getByRole("searchbox", { name: "Search Favalog" });
    expect(field).toHaveAttribute("name", "q");
    expect(field).toHaveAttribute(
      "placeholder",
      "Search movies, shows, books...",
    );
  });

  it("uses a custom label and shows the keyboard hint when provided", () => {
    render(<SearchInput label="Find titles" hint="⌘K" />);
    expect(
      screen.getByRole("searchbox", { name: "Find titles" }),
    ).toBeInTheDocument();
    expect(screen.getByText("⌘K")).toBeInTheDocument();
  });
});
