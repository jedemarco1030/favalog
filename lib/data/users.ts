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
  {
    id: "u_sana",
    handle: "sana",
    displayName: "Sana Iyer",
    avatarUrl: "/media/avatars/sana.svg",
    bio: "Reads on the train. Watches at 1x. No skipping intros.",
    followerCount: 612,
    followingCount: 240,
  },
  {
    id: "u_ravi",
    handle: "ravi",
    displayName: "Ravi Menon",
    avatarUrl: "/media/avatars/ravi.svg",
    bio: "Series completionist. Currently rationing the finale.",
    followerCount: 2015,
    followingCount: 143,
  },
  {
    id: "u_camille",
    handle: "camille",
    displayName: "Camille Roux",
    avatarUrl: "/media/avatars/camille.svg",
    bio: "Bookshops on holiday. Cinemas on Tuesdays.",
    followerCount: 774,
    followingCount: 302,
  },
  {
    id: "u_devon",
    handle: "devon",
    displayName: "Devon Halle",
    avatarUrl: "/media/avatars/devon.svg",
    bio: "Essays, essays, essays. And the occasional slow film.",
    followerCount: 1892,
    followingCount: 220,
  },
];

export function getUserById(id: string): User | undefined {
  return users.find((user) => user.id === id);
}
