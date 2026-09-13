import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FeedCard } from "@/components/feed/feed-card";
import {
  diaryItem,
  diaryWithReviewItem,
  rewatchItem,
  standaloneReviewItem,
} from "@/components/feed/feed-fixtures";

/**
 * The card's contract is mostly about LINK SAFETY and truthful wording: three
 * separate sibling destinations that all really exist, no nested anchors, no
 * dead controls, and never a link into another user's private diary.
 */
describe("FeedCard", () => {
  it("links separately to the actor's profile and the canonical title", () => {
    render(<FeedCard item={diaryItem} />);

    expect(screen.getByRole("link", { name: "Mira Chen" })).toHaveAttribute(
      "href",
      "/profile/mira",
    );
    expect(screen.getByRole("link", { name: "Afterglow" })).toHaveAttribute(
      "href",
      "/title/afterglow",
    );
    expect(
      screen.getByRole("link", { name: "View Afterglow" }),
    ).toHaveAttribute("href", "/title/afterglow");

    // Source-backed wording only.
    expect(screen.getByText("watched")).toBeInTheDocument();
    expect(screen.getByLabelText("4.5 out of 5 stars")).toBeInTheDocument();
  });

  it("renders a combined diary + review action as one card with a review destination", () => {
    render(<FeedCard item={diaryWithReviewItem} />);

    // One card, the DIARY verb — a review never turns "read" into "reviewed".
    expect(screen.getByText("read")).toBeInTheDocument();
    expect(screen.queryByText("reviewed")).not.toBeInTheDocument();

    expect(
      screen.getByText(/every page of that time is earned/),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Jamie Rivera’s reviews/ }),
    ).toHaveAttribute("href", "/profile/jamie#reviews");

    // The backdated diary date is shown next to the record time.
    expect(screen.getByText(/logged for/)).toBeInTheDocument();
  });

  it("keeps every link a sibling — no anchor is nested inside another", () => {
    const { container } = render(<FeedCard item={diaryWithReviewItem} />);
    for (const anchor of container.querySelectorAll("a")) {
      expect(anchor.querySelector("a")).toBeNull();
    }
  });

  it("never links into another user's diary", () => {
    const { container } = render(<FeedCard item={diaryWithReviewItem} />);
    const hrefs = Array.from(container.querySelectorAll("a")).map((a) =>
      a.getAttribute("href"),
    );
    expect(hrefs.every((href) => href && !href.startsWith("/diary"))).toBe(
      true,
    );
    // No dead controls: every link has a real destination.
    expect(hrefs.every((href) => href && href !== "#")).toBe(true);
  });

  it("conceals a spoiler-marked standalone review and says 'reviewed'", () => {
    render(<FeedCard item={standaloneReviewItem} />);

    expect(screen.getByText("reviewed")).toBeInTheDocument();
    expect(screen.queryByText(/recontextualises/)).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: /show spoilers for Northern Lights/i,
      }),
    ).toBeInTheDocument();
  });

  it("uses the revisit wording for a rewatch", () => {
    render(<FeedCard item={rewatchItem} />);
    expect(screen.getByText("rewatched")).toBeInTheDocument();
  });
});
