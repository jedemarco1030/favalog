import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ProfileHeader } from "@/components/user/profile-header";
import type { User } from "@/lib/types";

const user: User = {
  id: "u_test",
  username: "jamie",
  displayName: "Jamie DeMarco",
  avatarUrl: "/media/avatars/jamie.svg",
  bio: "Software engineer and lifelong collector of stories.",
  location: "Boston, MA",
  joinedAt: "2024-03-12T00:00:00.000Z",
  followerCount: 1284,
  followingCount: 312,
};

describe("ProfileHeader", () => {
  it("presents the identity: name, username, bio, location, and join date", () => {
    render(<ProfileHeader user={user} />);
    expect(
      screen.getByRole("heading", { level: 1, name: "Jamie DeMarco" }),
    ).toBeInTheDocument();
    expect(screen.getByText("@jamie")).toBeInTheDocument();
    expect(
      screen.getByText(/lifelong collector of stories/),
    ).toBeInTheDocument();
    expect(screen.getByText("Boston, MA")).toBeInTheDocument();
    expect(screen.getByText(/March 2024/)).toBeInTheDocument();
  });

  it("labels follower and following counts understandably", () => {
    render(<ProfileHeader user={user} />);
    expect(screen.getByText("1,284")).toBeInTheDocument();
    expect(screen.getByText(/followers/)).toBeInTheDocument();
    expect(screen.getByText("312")).toBeInTheDocument();
    expect(screen.getByText(/following/)).toBeInTheDocument();
  });

  it("shows the current-user Edit profile action only for one's own profile", () => {
    const { rerender } = render(
      <ProfileHeader user={user} isCurrentUser={false} />,
    );
    expect(
      screen.queryByRole("button", { name: "Edit profile" }),
    ).not.toBeInTheDocument();

    rerender(<ProfileHeader user={user} isCurrentUser />);
    expect(
      screen.getByRole("button", { name: "Edit profile" }),
    ).toBeInTheDocument();
  });

  it("omits the location when the user has none", () => {
    render(<ProfileHeader user={{ ...user, location: undefined }} />);
    expect(screen.queryByText("Boston, MA")).not.toBeInTheDocument();
    // The join date still renders even without a location.
    expect(screen.getByText(/March 2024/)).toBeInTheDocument();
  });
});
