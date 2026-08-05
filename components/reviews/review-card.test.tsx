import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ReviewCard } from "@/components/reviews/review-card";
import { getMediaById, getUserById, reviews } from "@/lib/data";

const review = reviews[0]; // r_1: Mira Bhatt on Afterglow, 4.5, 142 likes
const user = getUserById(review.userId)!;
const media = getMediaById(review.mediaId)!;

describe("ReviewCard", () => {
  it("shows the reviewer, username, title, and body", () => {
    render(<ReviewCard review={review} user={user} media={media} />);
    expect(screen.getByText("Mira Bhatt")).toBeInTheDocument();
    expect(screen.getByText("@mira")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: review.title }),
    ).toBeInTheDocument();
    expect(screen.getByText(/quietest work of her career/)).toBeInTheDocument();
  });

  it("renders the rating and like count", () => {
    render(<ReviewCard review={review} user={user} media={media} />);
    expect(screen.getByLabelText("4.5 out of 5 stars")).toBeInTheDocument();
    expect(screen.getByText("142 likes")).toBeInTheDocument();
  });

  it("links back to the reviewed title", () => {
    render(<ReviewCard review={review} user={user} media={media} />);
    expect(screen.getByRole("link")).toHaveAttribute(
      "href",
      "/title/afterglow",
    );
  });
});
