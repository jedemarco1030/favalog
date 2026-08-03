import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StarRating } from "@/components/ui/star-rating";

describe("StarRating", () => {
  it("exposes the rating to assistive tech as an accessible label", () => {
    render(<StarRating value={4.5} />);
    expect(screen.getByLabelText("4.5 out of 5 stars")).toBeInTheDocument();
  });

  it("shows a numeric value only when requested", () => {
    const { rerender } = render(<StarRating value={3} />);
    expect(screen.queryByText("3.0")).not.toBeInTheDocument();

    rerender(<StarRating value={3} showNumeric />);
    expect(screen.getByText("3.0")).toBeInTheDocument();
  });

  it("clamps out-of-range values into 0–5", () => {
    render(<StarRating value={9} />);
    expect(screen.getByLabelText("5 out of 5 stars")).toBeInTheDocument();
  });
});
