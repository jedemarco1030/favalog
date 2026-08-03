import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RatingBreakdown } from "@/components/media/rating-breakdown";
import type { RatingDistribution } from "@/lib/types";

const distribution: RatingDistribution = {
  mediaId: "m_afterglow",
  count: 1000,
  average: 4.3,
  buckets: [20, 40, 140, 400, 400],
};

describe("RatingBreakdown", () => {
  it("shows the average and pluralized total count", () => {
    render(<RatingBreakdown distribution={distribution} />);
    expect(screen.getByText("4.3")).toBeInTheDocument();
    expect(screen.getByText(/1,000/)).toBeInTheDocument();
    expect(screen.getByText(/ratings/)).toBeInTheDocument();
  });

  it("renders one accessible row per whole-star bucket", () => {
    render(<RatingBreakdown distribution={distribution} />);
    const list = screen.getByRole("list", { name: "Rating distribution" });
    expect(list).toBeInTheDocument();
    expect(screen.getByText("5 stars")).toBeInTheDocument();
    expect(screen.getByText("1 stars")).toBeInTheDocument();
  });

  it("uses the singular noun for a single rating", () => {
    render(
      <RatingBreakdown
        distribution={{ ...distribution, count: 1, buckets: [0, 0, 0, 0, 1] }}
      />,
    );
    expect(screen.getByText(/^\s*1\s+rating$/)).toBeInTheDocument();
  });
});
