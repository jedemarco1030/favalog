# 0003 — AI Discovery v1: hybrid catalog retrieval (keyword + pgvector)

- **Status:** Accepted
- **Date:** 2026-08-23
- **Phase:** 3 (AI Discovery — catalog search)
- **Builds on:** [0001 — Supabase/PostgreSQL as the Favalog backend](0001-supabase-backend.md)

## Context

Favalog's `/explore` surface has to date searched only the in-memory mock
catalog on the client (`searchTermsFor` in `@/lib/data`). Now that the
Supabase catalog owns all **28** curated movies / TV / books, discovery should
run against real `media_items` and understand natural-language intent
("cozy space movies", "books about grief") without regressing exact-title
lookups or leaking anything sensitive.

The requirements shaping this phase:

- **Retrieval, not generation.** Users need to _find_ existing curated titles,
  not read machine-written prose. No LLM-generated text is introduced.
- **Meaning + keywords.** Pure keyword search misses paraphrases; pure semantic
  search can demote an exact-title match and hallucinate loose neighbors. We
  need both.
- **Keyword must never depend on embeddings.** Search has to work with zero
  embeddings, no OpenAI key, or the semantic path disabled — the page must
  never fail.
- **A hard security boundary around embeddings and secrets.** The
  `OPENAI_API_KEY` is server-only; raw vectors must never reach the browser;
  the app (not the browser) generates the trusted query embedding.
- **Small, controlled corpus.** The 28 curated titles are a stable, reviewable
  dataset — ideal for a human-reviewed evaluation harness and cheap embeddings.
- **No new heavy dependencies.** Keep secret-free, offline builds dependency-free
  (no vector-DB service, no OpenAI SDK).

## Decision

Ship **AI Discovery v1** as a **hybrid retrieval** system over the curated
Supabase catalog:

1. **Two retrieval signals, fused.** Postgres full-text search (lexical) and
   pgvector cosine similarity (semantic) are combined with **Reciprocal-Rank
   Fusion** (`RRF_K = 60`). **Exact-title protection** guarantees a direct
   title query is never demoted below its lexical match.
2. **pgvector inside the existing Postgres**, not a separate vector database.
   The `vector` extension lives in the `extensions` schema; embeddings live in a
   **private** `public.media_search_documents` table (`vector(512)` + content +
   `content_hash` + provider/model/dimensions provenance + timestamps, FK
   `ON DELETE CASCADE`, an all-or-nothing embedding CHECK, and an HNSW cosine
   index).
3. **OpenAI `text-embedding-3-small` at `dimensions: 512`** (Matryoshka
   truncation) for cost/storage reduction, behind a small internal
   `EmbeddingProvider` interface (`lib/search/embedding-provider.ts`). A
   deterministic `FakeEmbeddingProvider` powers tests/offline eval; a
   server-only OpenAI adapter uses a direct REST `fetch` (no SDK dependency,
   swappable behind the interface).
4. **Central config** in `lib/search/config.ts` (model, `dimensions = 512`,
   `RRF_K = 60`, candidate limits = 50, `DEFAULT_RESULT_LIMIT = 24`,
   `MAX_RESULT_LIMIT = 50`, `MAX_QUERY_LENGTH = 200`,
   `EMBEDDING_TIMEOUT_MS = 2500`, pipeline batch/concurrency/retry knobs) plus a
   server-only kill switch `SEMANTIC_SEARCH_ENABLED` (a falsey token disables
   semantic; keyword keeps working).
5. **A versioned, pure canonical embedding document**
   (`lib/search/canonical-document.ts`): catalog-only fields (title, subtitle,
   kind, year, genres, credits by kind, synopsis) in a stable order with
   normalization, versioned (`CANONICAL_DOCUMENT_VERSION = "v1"`) and folded
   with a SHA-256 content hash that drives skip-unchanged and stale-on-change
   re-embedding. No user data, no secrets, no mock-user attribution.
6. **Forward-only migrations** (after `20260814160300`): catalog enrichment +
   a STORED `search_tsv` with a GIN index (lexical on the public catalog),
   the private embedding table + pgvector, and the search functions —
   `keyword_search` (`SECURITY INVOKER`, public catalog) plus `semantic_search`
   / `hybrid_search` (`SECURITY DEFINER`, the narrow, justified exception to
   read the private embedding table).
7. **A server-only query service with keyword fallback.** Validate the query,
   always run keyword; when semantic is enabled and configured, request **one**
   query embedding with a 2500 ms timeout, then run hybrid; on timeout/failure,
   return keyword results and never fail the page. Mode is recorded as
   `hybrid` | `keyword` | `keyword_fallback`.

See [`docs/ai-discovery-system-card.md`](../ai-discovery-system-card.md) for the
system card and [`docs/backend-architecture.md`](../backend-architecture.md) for
the schema/security detail.

### Why retrieval before generative AI

Generative answers introduce hallucination, moderation, latency, recurring
per-token cost, and prompt-injection surface — none of which a "help me find a
title I'll love" job requires. Retrieval over a curated corpus is verifiable
(every result is a real catalog row), cheap, fast, and honest. Generation, if
ever justified, can layer on top of a trustworthy retrieval base.

### Why Postgres/pgvector instead of a separate vector database

The corpus is 28 rows and grows slowly; a dedicated vector service (Pinecone,
Weaviate, a self-hosted store) would add an operational dependency, a second
source of truth, and a sync problem for **no** measurable recall benefit at this
scale. Keeping embeddings in the same Postgres means one backup/restore, one
migration ledger, one RLS model, transactional consistency with the catalog
(FK `ON DELETE CASCADE`), and reuse of the existing security posture. HNSW
cosine indexing in pgvector is more than adequate here.

### Why hybrid beats semantic-only

Lexical search nails exact titles, names, and rare tokens but misses
paraphrase; semantic search captures intent but can rank a loose thematic
neighbor above the literally-named title and is sensitive to embedding drift.
RRF fusion (`k = 60`) takes the best of both without hand-tuned weights, and
**exact-title protection** guarantees that typing a title returns that title
first. Fusing rank positions (not raw scores) also avoids having to calibrate
incomparable lexical `ts_rank` and cosine scales.

### Why the corpus is intentionally controlled

A small, human-curated catalog is a feature this phase, not a limitation: it
keeps embedding cost trivial, makes a **human-reviewed golden dataset**
feasible, gives deterministic evaluation, and avoids ingestion/licensing
complexity. External catalog ingestion (TMDB / Open Library / Google Books) and
an unbounded corpus are explicitly out of scope.

### Model + dimension selection

`text-embedding-3-small` is inexpensive and strong for short catalog documents.
We request `dimensions: 512` (Matryoshka truncation) rather than the full
1536: at this corpus size the retrieval quality difference is negligible while
storage and index size drop ~3×. The choice is captured in config **and**
persisted per row (`provider` / `model` / `dimensions`) so a future model or
dimension change is detectable and re-embeddable rather than silent.

### The embedding security boundary

- `OPENAI_API_KEY` is **server-only** — never `NEXT_PUBLIC_`, never sent to the
  browser, never written to logs or error messages.
- The **application** generates the one trusted query embedding server-side; the
  browser never supplies vectors, weights, model, dimensions, or SQL.
- Raw embedding vectors are never exposed: `media_search_documents` has RLS
  enabled with **no** policies and `anon`/`authenticated` revoked, so the Data
  API cannot read it; only `service_role` writes it, and only the
  `SECURITY DEFINER` search functions read it — returning **only** safe catalog
  fields + a rank (never the vector).
- The pipeline embeds a **pure, catalog-only** canonical document — no user
  data, no secrets, no mock-user attribution.

### Exact-title protection

A query that matches a title exactly must return that title as the top result
regardless of semantic neighbors. This is enforced in the fusion step so that a
direct title lookup is never demoted — the single most important
"does search feel broken?" failure mode.

### Evaluation strategy

A human-reviewed **golden dataset** over the stable catalog drives an offline
harness (`npm run eval:search`) measuring **Recall@5**, **MRR**,
**exact-title top-1 accuracy**, **zero-result rate**, per-category breakdowns,
and latency (when live). It runs in three modes: a **deterministic secret-free**
mode (fixture rankings via `FakeEmbeddingProvider`), a **keyword baseline**, and
a **live hybrid** mode gated on a local Supabase + `OPENAI_API_KEY`. It emits
JSON + human-readable output and exits nonzero on a threshold regression.

### Failure / fallback behavior

Query validation runs first (string, normalized, non-empty, ≤ 200 chars; an
empty query never calls OpenAI). Keyword always runs. If semantic is enabled and
configured, exactly one query embedding is requested with a **2500 ms timeout**;
on timeout or any embedding/DB failure the service returns keyword results and
records mode `keyword_fallback` — the page never errors. Media-kind filters are
allow-listed and the result limit is server-clamped.

### Privacy & logging policy

Raw user query text is **never persisted**. Structured logs may carry a
correlation id, search mode, query **length**, embedding model, token count,
keyword/embedding/db/total latency, result count, a safe error category, and a
fallback reason — **never** the query itself, tokens/session, user identity,
API responses, or vectors.

### Cost & latency considerations

Catalog embeddings are computed once (and only re-computed when the versioned
canonical hash changes), so steady-state cost is dominated by **one** small
query embedding per explicit search — and searches are explicit (submit), not
per-keystroke. `dimensions: 512` keeps storage/index small; the 2500 ms timeout
bounds tail latency, with keyword as an always-available floor.

## Alternatives considered

- **Keyword-only (`tsvector` + GIN, no embeddings).** Cheapest and always
  available (it is our fallback), but misses natural-language intent and
  paraphrase. Kept as the floor, not the ceiling.
- **Semantic-only (pgvector, no lexical).** Understands intent but demotes exact
  titles and is sensitive to embedding drift; unacceptable for
  "type a title, get that title". Rejected in favor of hybrid.
- **A dedicated vector database** (Pinecone / Weaviate / Qdrant). Overkill for
  28 rows: extra service, extra secret, a sync/consistency problem, and cost for
  no recall gain at this scale. Revisit only when the corpus and QPS grow by
  orders of magnitude (see below).
- **Client-side embedding or client-supplied vectors/weights.** Would leak the
  API key and let a malicious client control ranking or read vectors. Rejected
  outright — the app owns the trusted embedding.
- **Adding the OpenAI SDK.** Convenient, but a new dependency that would need to
  be import-safe in secret-free/offline builds. A direct REST `fetch` behind the
  `EmbeddingProvider` interface keeps builds dependency-free and swappable.
- **Full 1536 dimensions.** Marginal quality benefit at this corpus size for ~3×
  the storage/index footprint. Rejected for `dimensions: 512`.
- **Generative answers / RAG summaries now.** Hallucination, moderation, cost,
  and latency with no benefit to a find-a-title job. Deferred.

## Consequences

**Positive**

- Natural-language and keyword discovery over the **real** catalog, with exact
  titles protected and results that are always real catalog rows.
- One datastore, one security model, one migration ledger; embeddings are
  transactionally consistent with the catalog.
- Keyword search works with **no** OpenAI key, the kill switch off, or the
  semantic path unavailable — the page never fails.
- Secret-free, offline builds stay dependency-free; a deterministic eval harness
  makes quality measurable and regressions blocking.

**Negative / costs**

- A `SECURITY DEFINER` read path exists (narrowly scoped and justified below);
  it must be reviewed with care on every change.
- Embeddings must be (re)generated when the versioned canonical document
  changes; a stale hash silently degrades semantic quality until re-embedded.
- A recurring (if tiny) per-query embedding cost and an external dependency on
  OpenAI availability (mitigated by the timeout + keyword fallback).

## Security implications

- `OPENAI_API_KEY` is server-only; never `NEXT_PUBLIC_`, never logged, never in
  errors or the browser.
- `media_search_documents` has RLS enabled with **no** policies, `anon` /
  `authenticated` revoked; only `service_role` writes and only the search
  functions read it. Raw vectors are never returned by the Data API or the
  functions.
- `keyword_search` is `SECURITY INVOKER` over the public catalog.
  `semantic_search` / `hybrid_search` are `SECURITY DEFINER` **only** to read
  the private embedding table, and are hardened: pinned empty `search_path`,
  fully schema-qualified, no dynamic SQL, clamped limits, read-only, returning
  only safe catalog fields + rank, with EXECUTE revoked from `public` and
  granted to `anon` + `authenticated`.
- Untrusted query text flows **only** through `websearch_to_tsquery` — never
  interpolated into SQL. The result limit is server-clamped and media-kind
  filters are allow-listed. The browser never supplies vectors, weights, model,
  dimensions, or SQL.

## Conditions that would justify changing vector storage, model, or ranking

- **Vector storage → a dedicated vector DB:** the corpus grows to hundreds of
  thousands / millions of rows, or query volume, latency, or index memory in
  Postgres becomes the bottleneck, or filtered-ANN needs outgrow pgvector.
- **Model / dimensions:** a materially better or cheaper embedding model ships,
  live evaluation shows the 512-dim truncation costs meaningful recall, or a
  multilingual/multimodal requirement appears. The persisted `provider` /
  `model` / `dimensions` provenance makes a re-embed detectable and safe.
- **Ranking strategy:** evaluation shows RRF (`k = 60`) is beaten by a tuned or
  learned scheme (e.g. weighted fusion, a cross-encoder re-rank), or exact-title
  protection needs to generalize to aliases/localized titles. Any change must be
  proven against the golden dataset with the thresholds still enforced.

## Note on this environment

No live semantic evaluation was run in this environment: **no OpenAI key was
present**, so the OpenAI adapter and the live-hybrid eval mode were not
exercised and **no live semantic quality numbers are claimed**. The
deterministic secret-free eval mode (fixtures via `FakeEmbeddingProvider`) and
the keyword baseline are the exercised paths. Live hybrid metrics must be
produced against a local Supabase stack with `OPENAI_API_KEY` set before any
semantic quality figure is asserted.
