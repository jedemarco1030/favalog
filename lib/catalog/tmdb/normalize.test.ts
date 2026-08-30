import { describe, expect, it } from "vitest";

import {
  mapTmdbTvStatus,
  normalizeTmdbMovie,
  normalizeTmdbMovieCandidate,
  normalizeTmdbTv,
  normalizeTmdbTvCandidate,
} from "./normalize";
import type {
  TmdbMovieDetail,
  TmdbSearchMovieResult,
  TmdbSearchTvResult,
  TmdbTvDetail,
} from "./types";

function movieDetail(
  overrides: Partial<TmdbMovieDetail> = {},
): TmdbMovieDetail {
  return {
    id: 603,
    title: "The Matrix",
    original_title: "The Matrix",
    overview: "A hacker discovers the true nature of reality.",
    release_date: "1999-03-31",
    runtime: 136,
    genres: [
      { id: 28, name: "Action" },
      { id: 878, name: "Science Fiction" },
    ],
    poster_path: "/poster.jpg",
    backdrop_path: "/backdrop.jpg",
    vote_average: 8.2,
    credits: {
      cast: [
        { name: "Keanu Reeves", order: 0 },
        { name: "Carrie-Anne Moss", order: 1 },
        { name: "Second Billed", order: 2 },
      ],
      crew: [
        { name: "Lana Wachowski", job: "Director" },
        { name: "Someone Else", job: "Producer" },
      ],
    },
    ...overrides,
  };
}

function tvDetail(overrides: Partial<TmdbTvDetail> = {}): TmdbTvDetail {
  return {
    id: 1399,
    name: "Game of Thrones",
    original_name: "Game of Thrones",
    overview: "Noble families vie for control of the Iron Throne.",
    first_air_date: "2011-04-17",
    number_of_seasons: 8,
    number_of_episodes: 73,
    genres: [{ id: 18, name: "Drama" }],
    created_by: [{ name: "David Benioff" }, { name: "D. B. Weiss" }],
    status: "Ended",
    poster_path: "/got.jpg",
    backdrop_path: "/got-bd.jpg",
    vote_average: 8.4,
    ...overrides,
  };
}

describe("normalizeTmdbMovie", () => {
  it("maps the core fields into a normalized movie", () => {
    const item = normalizeTmdbMovie(movieDetail());
    expect(item.kind).toBe("movie");
    expect(item.ref).toEqual({
      provider: "tmdb",
      kind: "movie",
      externalId: "603",
    });
    expect(item.title).toBe("The Matrix");
    expect(item.synopsis).toBe(
      "A hacker discovers the true nature of reality.",
    );
    expect(item.year).toBe(1999);
    expect(item.genres).toEqual(["Action", "Science Fiction"]);
    expect(item.averageRating).toBe(4.1); // 8.2 / 10 * 5
  });

  it("derives the director from crew job === 'Director'", () => {
    const item = normalizeTmdbMovie(movieDetail());
    if (item.kind !== "movie") throw new Error("expected a movie");
    expect(item.director).toBe("Lana Wachowski");
  });

  it("orders cast by `order` and caps runtime as a positive int", () => {
    const item = normalizeTmdbMovie(
      movieDetail({
        credits: {
          cast: [
            { name: "Third", order: 2 },
            { name: "First", order: 0 },
            { name: "Second", order: 1 },
          ],
          crew: [{ name: "Dir", job: "Director" }],
        },
      }),
    );
    if (item.kind !== "movie") throw new Error("expected a movie");
    expect(item.cast).toEqual(["First", "Second", "Third"]);
    expect(item.runtimeMinutes).toBe(136);
  });

  it("builds approved image-host URLs from poster/backdrop paths", () => {
    const item = normalizeTmdbMovie(movieDetail());
    expect(item.posterUrl).toBe("https://image.tmdb.org/t/p/w500/poster.jpg");
    expect(item.backdropUrl).toBe(
      "https://image.tmdb.org/t/p/w1280/backdrop.jpg",
    );
  });

  it("leaves image URLs undefined when the paths are missing", () => {
    const item = normalizeTmdbMovie(
      movieDetail({ poster_path: null, backdrop_path: undefined }),
    );
    expect(item.posterUrl).toBeUndefined();
    expect(item.backdropUrl).toBeUndefined();
  });

  it("degrades a missing overview to '' and missing genres to []", () => {
    const item = normalizeTmdbMovie(
      movieDetail({ overview: undefined, genres: undefined }),
    );
    expect(item.synopsis).toBe("");
    expect(item.genres).toEqual([]);
  });
});

describe("normalizeTmdbTv", () => {
  it("maps name, air date, creators, counts, and status", () => {
    const item = normalizeTmdbTv(tvDetail());
    expect(item.kind).toBe("tv");
    expect(item.ref).toEqual({
      provider: "tmdb",
      kind: "tv",
      externalId: "1399",
    });
    expect(item.title).toBe("Game of Thrones");
    expect(item.year).toBe(2011);
    if (item.kind !== "tv") throw new Error("expected a tv item");
    expect(item.creators).toEqual(["David Benioff", "D. B. Weiss"]);
    expect(item.seasons).toBe(8);
    expect(item.episodes).toBe(73);
    expect(item.status).toBe("ended");
  });
});

describe("mapTmdbTvStatus", () => {
  it("maps ended states to 'ended'", () => {
    expect(mapTmdbTvStatus("Ended")).toBe("ended");
    expect(mapTmdbTvStatus("Canceled")).toBe("ended");
    expect(mapTmdbTvStatus("Cancelled")).toBe("ended");
  });

  it("maps upcoming states to 'upcoming'", () => {
    expect(mapTmdbTvStatus("In Production")).toBe("upcoming");
    expect(mapTmdbTvStatus("Planned")).toBe("upcoming");
  });

  it("maps 'Returning Series' and anything else to 'ongoing'", () => {
    expect(mapTmdbTvStatus("Returning Series")).toBe("ongoing");
    expect(mapTmdbTvStatus("Something Unknown")).toBe("ongoing");
    expect(mapTmdbTvStatus(undefined)).toBe("ongoing");
  });
});

describe("TMDB candidate helpers", () => {
  it("returns a movie candidate with kind 'movie'", () => {
    const result: TmdbSearchMovieResult = {
      id: 603,
      title: "The Matrix",
      release_date: "1999-03-31",
      poster_path: "/poster.jpg",
    };
    const candidate = normalizeTmdbMovieCandidate(result);
    expect(candidate).not.toBeNull();
    expect(candidate?.kind).toBe("movie");
    expect(candidate?.ref.externalId).toBe("603");
    expect(candidate?.year).toBe(1999);
  });

  it("returns a tv candidate with kind 'tv'", () => {
    const result: TmdbSearchTvResult = {
      id: 1399,
      name: "Game of Thrones",
      first_air_date: "2011-04-17",
    };
    const candidate = normalizeTmdbTvCandidate(result);
    expect(candidate?.kind).toBe("tv");
    expect(candidate?.ref.externalId).toBe("1399");
  });

  it("returns null when the id is missing", () => {
    expect(
      normalizeTmdbMovieCandidate({ title: "No Id" } as TmdbSearchMovieResult),
    ).toBeNull();
    expect(
      normalizeTmdbTvCandidate({ name: "No Id" } as TmdbSearchTvResult),
    ).toBeNull();
  });

  it("returns null when the title is missing", () => {
    expect(normalizeTmdbMovieCandidate({ id: 1 })).toBeNull();
    expect(normalizeTmdbTvCandidate({ id: 1 })).toBeNull();
  });
});

describe("TMDB image URL safety", () => {
  it("builds a poster URL from a leading-slash path", () => {
    const candidate = normalizeTmdbMovieCandidate({
      id: 5,
      title: "Has Poster",
      poster_path: "/abc.jpg",
    });
    expect(candidate?.posterUrl).toBe(
      "https://image.tmdb.org/t/p/w500/abc.jpg",
    );
    expect(
      candidate?.posterUrl?.startsWith(
        "https://image.tmdb.org/t/p/w500/abc.jpg",
      ),
    ).toBe(true);
  });

  it("rejects a non-slash / absolute image path", () => {
    const candidate = normalizeTmdbMovieCandidate({
      id: 6,
      title: "Bad Poster",
      poster_path: "https://evil.example.com/x.jpg",
    });
    expect(candidate?.posterUrl).toBeUndefined();
  });
});
