import type { User } from "@/lib/types";

export const users: User[] = [
  {
    id: "u_ari",
    handle: "ari",
    displayName: "Ari Okafor",
    avatarUrl: "/media/avatars/ari.svg",
    bio: "Slow reader, fast watcher. Chronicles of the mundane.",
    followerCount: 1284,
    followingCount: 312,
  },
  {
    id: "u_mira",
    handle: "mira",
    displayName: "Mira Bhatt",
    avatarUrl: "/media/avatars/mira.svg",
    bio: "Film school dropout. Print-first. Coffee-second.",
    followerCount: 908,
    followingCount: 201,
  },
  {
    id: "u_jules",
    handle: "jules",
    displayName: "Jules Marchetti",
    avatarUrl: "/media/avatars/jules.svg",
    bio: "Notes from the couch. Sci-fi, noir, and long trilogies.",
    followerCount: 3421,
    followingCount: 187,
  },
];

export function getUserById(id: string): User | undefined {
  return users.find((user) => user.id === id);
}
