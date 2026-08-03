import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ActivityCard } from "@/components/activity/activity-card";
import { activity, getMediaById, getUserById } from "@/lib/data";

const item = activity[0]; // a_1: Ravi Menon reviewed Dune: Part Two
const user = getUserById(item.userId)!;
const media = getMediaById(item.mediaId)!;

describe("ActivityCard", () => {
  it("describes who did what to which title", () => {
    render(<ActivityCard activity={item} user={user} media={media} />);
    expect(screen.getByText("Ravi Menon")).toBeInTheDocument();
    expect(screen.getByText("reviewed")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: media.title })).toHaveAttribute(
      "href",
      `/title/${media.slug}`,
    );
  });

  it("shows the rating and review excerpt when present", () => {
    render(<ActivityCard activity={item} user={user} media={media} />);
    expect(screen.getByLabelText("4.5 out of 5 stars")).toBeInTheDocument();
    expect(screen.getByText(/Bigger than the first/)).toBeInTheDocument();
  });

  it("omits the excerpt for activity without one", () => {
    const finished = activity.find((a) => a.kind === "finished")!;
    const u = getUserById(finished.userId)!;
    const m = getMediaById(finished.mediaId)!;
    render(<ActivityCard activity={finished} user={u} media={m} />);
    expect(screen.getByText("finished")).toBeInTheDocument();
  });
});
