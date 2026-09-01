#!/usr/bin/env node
/**
 * Local, OFFLINE fixture HTTP server for deterministic Playwright coverage of
 * Catalog Platform v1B (federated Explore + on-demand materialization).
 *
 * It emulates the small slice of the TMDB and Open Library HTTP shapes that the
 * REAL server adapters (`lib/catalog/tmdb/client.ts`,
 * `lib/catalog/openlibrary/client.ts`) consume. The app under test reaches it
 * ONLY through the test-only, loopback-guarded transport seam
 * (`lib/catalog/test-transport.ts`): the Playwright web server sets
 * `CATALOG_TEST_TRANSPORT=1` plus `CATALOG_TEST_TMDB_BASE_URL` /
 * `CATALOG_TEST_OPENLIBRARY_BASE_URL` pointing here (127.0.0.1). No provider
 * secrets, no external network calls, no database access.
 *
 * Deterministic behavior by query token (case-insensitive):
 *   - "voyager": TMDB returns a BRAND-NEW importable movie (id 999001) not in
 *     the seeded catalog; Open Library returns nothing.
 *   - "dune":    TMDB returns "Dune: Part Two" (id 693134, 2024) — the SAME
 *     real-world work as the seeded curated `dune-part-two`, so importing it
 *     canonically LINKS to the existing title (no duplicate). Open Library
 *     FAILS (HTTP 500) for this token, exercising "one provider down while the
 *     other + local results survive".
 *   - "book":    Open Library returns one importable book; TMDB returns nothing.
 *   - "sandworm": Open Library returns one importable book whose WORK record
 *     OMITS first_publish_date (like the real Dune Work OL893414W); the year is
 *     only recoverable via the adapter's bounded exact Work-key Search fallback
 *     (`q=key:"/works/<id>"`), which this server answers with key + year only.
 *
 * Bind to 127.0.0.1 only. Port from FIXTURE_PORT (default 5599).
 */

import { createServer } from "node:http";

const PORT = Number(process.env.FIXTURE_PORT ?? 5599);
const HOST = "127.0.0.1";

// --- Catalog of fixture works ---------------------------------------------

const VOYAGER = {
  id: 999001,
  title: "Fixture Voyager Chronicles",
  overview:
    "A deterministic fixture film about a lone survey ship charting an " +
    "uncharted rift beyond the heliopause.",
  year: 2029,
  releaseDate: "2029-07-04",
  runtime: 121,
  genres: [
    { id: 878, name: "Science Fiction" },
    { id: 12, name: "Adventure" },
  ],
  cast: ["Ada Fixture", "Run Harness"],
  directors: ["Dee Terministic"],
};

const DUNE = {
  id: 693134,
  title: "Dune: Part Two",
  overview:
    "Paul Atreides unites with the Fremen to wage war against those who " +
    "destroyed his family.",
  year: 2024,
  releaseDate: "2024-03-01",
  runtime: 167,
  genres: [
    { id: 878, name: "Science Fiction" },
    { id: 12, name: "Adventure" },
  ],
  cast: ["Timothée Chalamet", "Zendaya"],
  directors: ["Denis Villeneuve"],
};

const FIXTURE_BOOK = {
  workId: "OL9000001W",
  authorId: "OL9000001A",
  authorName: "Fixture Field Author",
  title: "Fixture Field Guide",
  description:
    "A deterministic fixture book cataloguing imaginary flora for E2E tests.",
  firstPublishYear: 2021,
  subjects: ["Fixture", "Reference"],
};

// A book modelling the real Dune Work (OL893414W): its WORK record has NO
// first_publish_date, so the year is only knowable via the exact Work-key
// Search fallback. The DISCOVERY search doc still carries the year (Search API
// exposes it); only the Work detail omits it.
const FIXTURE_DATED_BOOK = {
  workId: "OL9300001W",
  authorId: "OL9300001A",
  authorName: "Fixture Sand Author",
  title: "Fixture Sandworm Saga",
  description:
    "A deterministic fixture book whose Work record omits its publish date, " +
    "mirroring real Open Library Works whose year is only known via Search.",
  firstPublishYear: 1965,
  subjects: ["Fixture", "Science Fiction"],
};

/** All Open Library fixture books, for Work-key fallback resolution. */
const OL_BOOKS = [FIXTURE_BOOK, FIXTURE_DATED_BOOK];

// --- Shape builders (mirror the provider JSON the adapters parse) ----------

function tmdbSearchResult(work) {
  return {
    id: work.id,
    title: work.title,
    original_title: work.title,
    release_date: work.releaseDate,
    poster_path: null, // null → graceful fallback, no external image fetch
  };
}

function tmdbMovieDetail(work) {
  return {
    id: work.id,
    title: work.title,
    original_title: work.title,
    overview: work.overview,
    release_date: work.releaseDate,
    runtime: work.runtime,
    genres: work.genres,
    poster_path: null,
    backdrop_path: null,
    vote_average: 0,
    credits: {
      cast: work.cast.map((name, order) => ({ name, order })),
      crew: work.directors.map((name) => ({
        name,
        job: "Director",
        department: "Directing",
      })),
    },
  };
}

function olSearchDoc(book) {
  return {
    key: `/works/${book.workId}`,
    title: book.title,
    author_name: [book.authorName],
    first_publish_year: book.firstPublishYear,
    cover_i: null,
    subject: book.subjects,
  };
}

function olWork(book) {
  return {
    key: `/works/${book.workId}`,
    title: book.title,
    description: { value: book.description },
    subjects: book.subjects,
    covers: [],
    first_publish_date: String(book.firstPublishYear),
    authors: [{ author: { key: `/authors/${book.authorId}` } }],
  };
}

// Like olWork but WITHOUT first_publish_date, modelling a real Work record that
// omits the year (the adapter must recover it via the Work-key Search fallback).
function olWorkNoDate(book) {
  const record = olWork(book);
  delete record.first_publish_date;
  return record;
}

// --- Routing ---------------------------------------------------------------

function sendJson(res, code, body) {
  const payload = JSON.stringify(body);
  res.writeHead(code, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(payload),
  });
  res.end(payload);
}

function notFound(res) {
  res.writeHead(404, { "content-type": "text/plain" });
  res.end("fixture: not found");
}

const server = createServer((req, res) => {
  const url = new URL(req.url ?? "/", `http://${HOST}:${PORT}`);
  const path = url.pathname;
  const query = (
    url.searchParams.get("query") ??
    url.searchParams.get("q") ??
    ""
  ).toLowerCase();

  // ---- TMDB ----
  if (path === "/tmdb/search/movie") {
    const results = [];
    // "dune" and "linkme" both surface the existing-canonical Dune: Part Two.
    // "dune" is also a LOCAL catalog match (so the external Dune is dropped as a
    // duplicate); "linkme" is NOT a local match, so the external Dune surfaces
    // as an "already in your catalog" link that resolves to its current page.
    if (query.includes("dune") || query.includes("linkme")) {
      results.push(tmdbSearchResult(DUNE));
    }
    if (query.includes("voyager")) results.push(tmdbSearchResult(VOYAGER));
    return sendJson(res, 200, {
      page: 1,
      total_pages: 1,
      total_results: results.length,
      results,
    });
  }
  if (path === "/tmdb/search/tv") {
    return sendJson(res, 200, {
      page: 1,
      total_pages: 1,
      total_results: 0,
      results: [],
    });
  }
  if (path === `/tmdb/movie/${DUNE.id}`) {
    return sendJson(res, 200, tmdbMovieDetail(DUNE));
  }
  if (path === `/tmdb/movie/${VOYAGER.id}`) {
    return sendJson(res, 200, tmdbMovieDetail(VOYAGER));
  }

  // ---- Open Library ----
  if (path === "/ol/search.json") {
    // Bounded exact Work-key year fallback: the adapter asks `key:"/works/<id>"`
    // (fields key + first_publish_year, limit 1) ONLY when a Work record lacks a
    // date. Answer with the matching book's key + year and nothing else.
    if (query.startsWith("key:")) {
      const found = OL_BOOKS.find((b) =>
        query.includes(b.workId.toLowerCase()),
      );
      const docs = found
        ? [
            {
              key: `/works/${found.workId}`,
              first_publish_year: found.firstPublishYear,
            },
          ]
        : [];
      return sendJson(res, 200, { numFound: docs.length, start: 0, docs });
    }
    // Simulate ONE provider down for the "dune" scenario so local + TMDB survive.
    if (query.includes("dune")) {
      res.writeHead(500, { "content-type": "text/plain" });
      return res.end("fixture: simulated Open Library failure");
    }
    const docs = [];
    if (query.includes("book")) docs.push(olSearchDoc(FIXTURE_BOOK));
    // "sandworm" discovers the dateless-Work book (its Search doc DOES carry the
    // year; only its Work detail omits it).
    if (query.includes("sandworm")) docs.push(olSearchDoc(FIXTURE_DATED_BOOK));
    return sendJson(res, 200, { numFound: docs.length, start: 0, docs });
  }
  if (path === `/ol/works/${FIXTURE_BOOK.workId}.json`) {
    return sendJson(res, 200, olWork(FIXTURE_BOOK));
  }
  // The dateless-Work book: its Work detail intentionally OMITS first_publish_date.
  if (path === `/ol/works/${FIXTURE_DATED_BOOK.workId}.json`) {
    return sendJson(res, 200, olWorkNoDate(FIXTURE_DATED_BOOK));
  }
  if (path === `/ol/authors/${FIXTURE_BOOK.authorId}.json`) {
    return sendJson(res, 200, {
      key: `/authors/${FIXTURE_BOOK.authorId}`,
      name: FIXTURE_BOOK.authorName,
    });
  }
  if (path === `/ol/authors/${FIXTURE_DATED_BOOK.authorId}.json`) {
    return sendJson(res, 200, {
      key: `/authors/${FIXTURE_DATED_BOOK.authorId}`,
      name: FIXTURE_DATED_BOOK.authorName,
    });
  }

  return notFound(res);
});

server.listen(PORT, HOST, () => {
  // A single stdout line lets Playwright's webServer detect readiness.
  console.log(`[provider-fixture-server] listening on http://${HOST}:${PORT}`);
});

// Export the fixture identities so specs can assert against exact values.
export const FIXTURE_IDS = {
  voyager: {
    provider: "tmdb",
    kind: "movie",
    externalId: "movie:999001",
    title: VOYAGER.title,
  },
  dune: {
    provider: "tmdb",
    kind: "movie",
    externalId: "movie:693134",
    title: DUNE.title,
    existingSlug: "dune-part-two",
  },
  book: {
    provider: "openlibrary",
    kind: "book",
    externalId: FIXTURE_BOOK.workId,
    title: FIXTURE_BOOK.title,
  },
  datedBook: {
    provider: "openlibrary",
    kind: "book",
    externalId: FIXTURE_DATED_BOOK.workId,
    title: FIXTURE_DATED_BOOK.title,
    firstPublishYear: FIXTURE_DATED_BOOK.firstPublishYear,
  },
};
